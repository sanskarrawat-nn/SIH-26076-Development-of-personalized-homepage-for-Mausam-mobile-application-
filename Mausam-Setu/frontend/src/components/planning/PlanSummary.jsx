import { t } from "../../services/i18n";
import React from "react";
import { time } from "../../services/format";

export function Moment({ value, tz }) {
  return (
    <>
      {new Date(value).toLocaleString("en-IN", {
        timeZone: tz,
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })}
    </>
  );
}
export default function Summary({ item, title, tz }) {
  return (
    <article className="plan-result">
      <h3>{t(title)}</h3>
      {item.start && (
        <p className="small">
          <Moment value={item.start} tz={tz} />
          {item.end && <> – {time(item.end, tz)}</>}
        </p>
      )}
      {item.comfort != null && (
        <div className="comfort">
          <strong>
            {item.comfort}
            <small>/100</small>
          </strong>
          <span>
            {t(item.comfort_label)}
            <small>{t("Comfort estimate · not a safety score")}</small>
          </span>
        </div>
      )}
      <p>{t(item.message)}</p>
      {item.rain_probability != null && (
        <p>
          {t("Peak rain chance:")}
          <strong>{item.rain_probability}%</strong>
        </p>
      )}
      {item.rain_timing?.length > 0 && (
        <p>
          {t("Rain timing")}:{" "}
          {item.rain_timing.map((v) => time(v, tz)).join(", ")}
        </p>
      )}
      {item.backup && <p className="muted small">{t(item.backup)}</p>}
      {item.formula && (
        <details>
          <summary>{t("How comfort is calculated")}</summary>
          <p className="small">{item.formula}</p>
        </details>
      )}
      {item.aqi && <p className="muted small">{t(item.aqi)}</p>}
      {item.limitations && <p className="muted small">{t(item.limitations)}</p>}
    </article>
  );
}
