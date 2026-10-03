import { t } from "../services/i18n";
import React from "react";
import {
  MapPin,
  Bookmark,
  Droplets,
  Wind,
  ShieldCheck,
  TriangleAlert,
  ArrowUpRight,
} from "lucide-react";
import { formatMetric, condition, locationKey, time } from "../services/format";
import { IconWeather } from "./ui";
export default function WeatherOverview({
  data,
  profile,
  location,
  saved,
  onSave,
  onAlerts,
}) {
  const current = data.current_weather.metrics;
  const today = data.daily[0];
  return (
    <div className="overview">
      <section className="current-weather">
        <div className="current-top">
          <span>
            <MapPin size={16} />
            {data.location.name}
          </span>
          <button
            aria-label={t("Save or unsave current location")}
            className="save-weather"
            onClick={onSave}
          >
            <Bookmark
              size={19}
              fill={
                saved.some((x) => locationKey(x) === locationKey(location))
                  ? "currentColor"
                  : "none"
              }
            />
          </button>
        </div>
        <div className="current-main">
          <div>
            <p className="now-label">{t("RIGHT NOW")}</p>
            <div className="temperature">
              {current.temperature?.value != null
                ? Math.round(
                    profile.units === "imperial"
                      ? (current.temperature.value * 9) / 5 + 32
                      : current.temperature.value,
                  )
                : "—"}
              <span>°{profile.units === "imperial" ? t("F") : t("C")}</span>
            </div>
            <h2>{condition(data.current_weather.code)}</h2>
            <p className="feels">
              {t("Feels like")}
              {formatMetric(current.feels_like, profile.units)}
            </p>
          </div>
          <div className="weather-symbol">
            <IconWeather code={data.current_weather.code} size={112} />
          </div>
        </div>
        <div className="weather-bottom">
          <span>
            <Droplets size={17} />
            {formatMetric(current.humidity, profile.units)}
            {t("humidity")}
          </span>
          <span>
            <Wind size={18} />
            {formatMetric(current.wind, profile.units)}
          </span>
        </div>
        <div className="sun-times">
          <span>
            {t("Sunrise")}{" "}
            {today?.sunrise
              ? time(today.sunrise, data.location.timezone)
              : t("Unavailable")}
          </span>
          <span>
            {t("Sunset")}{" "}
            {today?.sunset
              ? time(today.sunset, data.location.timezone)
              : t("Unavailable")}
          </span>
        </div>
      </section>
      <section className="day-brief panel">
        <div className="section-head compact">
          <span className="eyebrow">{t("THE BIG PICTURE")}</span>
          <ShieldCheck size={20} />
        </div>
        <h2>
          {data.priority_alerts.length
            ? t("A few things to keep in mind.")
            : t("A clearer view of what’s ahead.")}
        </h2>
        {data.priority_alerts.length ? (
          <div className="advisories">
            {data.priority_alerts.slice(0, 2).map((a) => (
              <button className="advisory" key={a.id} onClick={onAlerts}>
                <TriangleAlert size={18} />
                <span>
                  <strong>
                    {a.type === "air"
                      ? t("Air quality")
                      : a.type.charAt(0).toUpperCase() + a.type.slice(1)}{" "}
                    · {a.severity}
                  </strong>
                  <small>{t(a.message)}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">
            {data.data_status.status === "unavailable"
              ? t("No reliable weather inputs are available.")
              : t(
                  "No configured weather thresholds are triggered by the available current inputs. Check the forecast before making plans.",
                )}
          </p>
        )}
        <div className="brief-footer">
          <span>{t("App-generated advisories")}</span>
          <button className="text-btn" onClick={onAlerts}>
            {t("View all (")}
            {data.priority_alerts.length})<ArrowUpRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
