import React from "react";
import { t } from "../services/i18n";
import { formatMetric, condition } from "../services/format";
import { IconWeather, Badge } from "./ui";
export default function WeatherGlance({ data, units }) {
  const risk = data.weather_risk;
  return (
    <section
      className="weather-glance"
      aria-label={t("Current weather and risk")}
    >
      <div className="glance-weather">
        <IconWeather code={data.current_weather.code} size={38} />
        <strong>
          {formatMetric(data.current_weather.metrics.temperature, units)}
        </strong>
        <div>
          <p className="glance-place">
            {data.location.name} <Badge status={data.data_status.status} />
          </p>
          <p>
            {condition(data.current_weather.code)} · {t("Feels like")}{" "}
            {formatMetric(data.current_weather.metrics.feels_like, units)}
          </p>
        </div>
      </div>
      <div className="glance-risk" data-risk={risk?.category}>
        <p>{t("Weather risk")}</p>
        <strong>
          {risk?.score == null
            ? t("Unavailable")
            : `${risk.score} / 100 · ${t(risk.category)}`}
        </strong>
        {risk?.score != null && (
          <progress
            className="risk-meter"
            max="100"
            value={risk.score}
            aria-label={t("Weather risk")}
          />
        )}
        <a href="#risk-title">{t("View risk and data coverage")}</a>
      </div>
    </section>
  );
}
