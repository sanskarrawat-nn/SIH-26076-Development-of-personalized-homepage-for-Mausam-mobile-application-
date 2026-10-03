import { t } from "../services/i18n";
import React, { useEffect, useState } from "react";

export default function LiveClock({ timezone }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="live-clock">
      <span>
        {t("Local clock ·")}
        {timezone}
      </span>
      <time dateTime={now.toISOString()}>
        {new Intl.DateTimeFormat("en-IN", {
          timeZone: timezone,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          day: "numeric",
          month: "short",
        }).format(now)}
      </time>
    </div>
  );
}
