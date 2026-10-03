import { t } from "../services/i18n";
import React, { useEffect, useState } from "react";

export default function LiveClock({
  timezone,
  simulated = false,
  referenceTime,
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (simulated) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [simulated]);
  const shown = simulated
    ? referenceTime
      ? new Date(referenceTime)
      : null
    : now;
  return (
    <div className="live-clock">
      <span>
        {simulated ? "DEMO / JUDGE MODE · " : t("Local clock ·")}
        {timezone}
      </span>
      {shown ? (
        <time dateTime={shown.toISOString()}>
          {new Intl.DateTimeFormat("en-IN", {
            timeZone: timezone,
            hour: "numeric",
            minute: "2-digit",
            ...(simulated
              ? { year: "numeric", hour12: false }
              : { second: "2-digit" }),
            day: "numeric",
            month: "short",
          }).format(shown)}
        </time>
      ) : (
        <span>{t("Loading scenario…")}</span>
      )}
      {simulated && <span>{t("Simulated conditions")}</span>}
    </div>
  );
}
