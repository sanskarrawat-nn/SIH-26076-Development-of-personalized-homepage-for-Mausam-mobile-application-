import { t } from "../services/i18n";
import React, { useState } from "react";
import { ArrowRight, Sunrise, Sunset } from "lucide-react";
import { formatMetric, time } from "../services/format";
import { IconWeather, Empty } from "./ui";
export default function Forecast({ data, units }) {
  const [tab, setTab] = useState("hourly");
  const tz = data.location.timezone;
  const points = data.hourly
    .filter((p) => new Date(p.time) >= new Date(data.reference_time))
    .slice(0, 24);
  return (
    <section className="panel forecast" id="forecast">
      <div className="section-head">
        <div>
          <span className="eyebrow">{t("PLAN A LITTLE AHEAD")}</span>
          <h2>{t("Your forecast")}</h2>
        </div>
        <div
          className="segmented"
          role="group"
          aria-label={t("Forecast period")}
        >
          <button
            aria-pressed={tab === "hourly"}
            onClick={() => setTab("hourly")}
          >
            {t("24 hours")}
          </button>
          <button
            aria-pressed={tab === "daily"}
            onClick={() => setTab("daily")}
          >
            {t("7 days")}
          </button>
        </div>
      </div>
      {tab === "hourly" ? (
        points.length ? (
          <div
            className="hourly-scroll"
            tabIndex={0}
            aria-label={t("Hourly forecast, scroll horizontally")}
          >
            {points.map((p, i) => (
              <div className={`hour ${i === 0 ? "first" : ""}`} key={p.time}>
                <span>{time(p.time, tz)}</span>
                <IconWeather code={p.code} />
                <strong>{formatMetric(p.metrics.temperature, units)}</strong>
                <small>{formatMetric(p.metrics.rain_probability, units)}</small>
              </div>
            ))}
          </div>
        ) : (
          <Empty title={t("Hourly forecast unavailable")}>
            {t("Retry when the weather service is available.")}
          </Empty>
        )
      ) : (
        <div className="daily-list">
          {data.daily.map((d) => (
            <div className="daily" key={d.date}>
              <strong>
                {new Intl.DateTimeFormat("en-IN", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                }).format(new Date(d.date + "T12:00:00Z"))}
              </strong>
              <span className="muted">
                {formatMetric(d.metrics.rain_probability, units)}
                {t("rain")}
              </span>
              <span>{formatMetric(d.metrics.low, units)}</span>
              <span aria-hidden="true" className="temp-range">
                –
              </span>
              <strong>{formatMetric(d.metrics.high, units)}</strong>
            </div>
          ))}
        </div>
      )}
      {data.daily[0]?.sunrise && (
        <div className="sun-times">
          <span>
            <Sunrise size={19} />
            {t("Sunrise")}
            <strong>{time(data.daily[0].sunrise, tz)}</strong>
          </span>
          <span>
            <Sunset size={19} />
            {t("Sunset")}
            <strong>{time(data.daily[0].sunset, tz)}</strong>
          </span>
        </div>
      )}
    </section>
  );
}
