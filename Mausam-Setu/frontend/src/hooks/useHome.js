import { useEffect, useState } from "react";
import { get, homeQuery } from "../services/api";
import { offlineCopy } from "../services/format";
import { readLocal, saveLocal } from "../services/storage";

export function useHome(location, profile, mode, scenario, lowData = false) {
  const [view, setView] = useState({
    query: null,
    data: null,
    error: "",
    loading: true,
  });
  const [revision, setRevision] = useState(0);
  const query = homeQuery(location, profile, mode, scenario);

  useEffect(() => {
    const controller = new AbortController();
    // Keep the current page mounted during background refreshes so open forms survive.
    setView((previous) =>
      previous.query === query
        ? { ...previous, error: "", loading: !previous.data }
        : { query, data: null, error: "", loading: true },
    );

    async function refresh() {
      try {
        const cached = readLocal("mausam.last-home", null);
        if (
          lowData &&
          cached?.query === query &&
          Date.now() - Date.parse(cached.home.data_status.retrieved_at) < 900000
        ) {
          const home = offlineCopy(cached.home);
          home.data_status.offline = !navigator.onLine;
          setView({ query, data: home, error: "", loading: false });
          return;
        }
        const home = await get(query, controller.signal);
        if (controller.signal.aborted) return;
        saveLocal("mausam.last-home", { query, home });
        setView({ query, data: home, error: "", loading: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        const saved = readLocal("mausam.last-home", null);
        let home = null;
        if (saved?.query === query) {
          try {
            home = offlineCopy(saved.home);
          } catch {
            /* An incompatible saved response cannot replace current weather. */
          }
        }
        setView({
          query,
          data: home,
          loading: false,
          error: home
            ? "Connection unavailable. Showing the last saved result for these preferences."
            : "Could not load this homepage. Start the backend or reconnect, then retry.",
        });
      }
    }
    refresh();
    return () => controller.abort();
  }, [query, revision, lowData]);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("online", refresh);
    const timer = setInterval(refresh, (lowData ? 30 : 15) * 60 * 1000);
    // Keep cached safety/risk expiry honest while the app stays open offline.
    const expire = setInterval(() => {
      setView((previous) => {
        if (
          !previous.data?.data_status?.offline ||
          previous.data.data_status.status === "simulated"
        )
          return previous;
        return { ...previous, data: offlineCopy(previous.data) };
      });
    }, 30 * 1000);
    return () => {
      window.removeEventListener("online", refresh);
      clearInterval(timer);
      clearInterval(expire);
    };
  }, [lowData]);

  const current =
    view.query === query ? view : { data: null, error: "", loading: true };
  return { ...current, retry: () => setRevision((value) => value + 1) };
}
