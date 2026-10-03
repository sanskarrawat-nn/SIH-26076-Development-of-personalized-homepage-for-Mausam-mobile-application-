import { t } from "../services/i18n";
import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { readLocal, saveLocal } from "../services/storage";

export function alertKey(alert) {
  return [alert.id, alert.status, alert.start_time, alert.message].join("|");
}

export default function AlertInbox({ data, onDetails }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(() => {
    const stored = readLocal("mausam.read-alerts", []);
    return Array.isArray(stored)
      ? stored.filter((item) => typeof item === "string").slice(-200)
      : [];
  });
  const root = useRef(null);
  const button = useRef(null);
  const alerts = data?.priority_alerts || [];
  const unread = alerts.filter(
    (alert) => !read.includes(alertKey(alert)),
  ).length;
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  function markRead() {
    const updated = [...new Set([...read, ...alerts.map(alertKey)])].slice(
      -200,
    );
    setRead(updated);
    saveLocal("mausam.read-alerts", updated);
  }
  return (
    <div className="alert-inbox" ref={root}>
      <button
        ref={button}
        className="icon-btn"
        aria-label={`Advisory inbox, ${unread} unread`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} />
        {unread > 0 && <span className="unread-count">{unread}</span>}
      </button>
      {open && (
        <section className="inbox-panel" aria-label={t("Advisory inbox")}>
          <h3>{t("Weather advisory inbox")}</h3>
          <p className="muted small">
            {t("App-generated guidance ·")}
            {unread}
            {t(
              "unread. Reading an advisory does not dismiss the weather risk.",
            )}
          </p>
          {alerts.length ? (
            alerts.map((alert) => (
              <button
                className="inbox-item"
                key={alert.id}
                onClick={() => {
                  setOpen(false);
                  onDetails();
                }}
              >
                <strong>
                  {!read.includes(alertKey(alert)) && "● "}
                  {t(alert.type)} · {t(alert.severity)}
                </strong>
                <span>{t(alert.message)}</span>
              </button>
            ))
          ) : (
            <p>
              {!data || data.data_status.status === "unavailable"
                ? t("Weather data unavailable; advisories cannot be assessed.")
                : t(
                    "No configured advisory thresholds triggered in the available data.",
                  )}
            </p>
          )}
          <button className="text-btn" disabled={!unread} onClick={markRead}>
            {t("Mark all as read")}
          </button>
        </section>
      )}
    </div>
  );
}
