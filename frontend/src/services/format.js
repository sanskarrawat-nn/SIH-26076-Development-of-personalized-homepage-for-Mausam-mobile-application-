import { t, locale } from "./i18n.js";
export const LABELS = {
  pressure: "Surface pressure",
  dew_point: "Dew point",
  wind_direction: "Wind direction",
  soil_moisture: "Soil moisture · 0–1 cm",
  soil_moisture_root: "Soil moisture · 3–9 cm",
  grass_pollen: "Grass pollen",
  birch_pollen: "Birch pollen",
  alder_pollen: "Alder pollen",
  temperature: "Temperature",
  feels_like: "Feels like",
  humidity: "Humidity",
  rain_probability: "Rain chance",
  precipitation: "Rainfall",
  wind: "Wind",
  uv: "UV index",
  visibility: "Visibility",
  aqi: "US AQI",
  pm25: "PM2.5",
  pm10: "PM10",
  wave_height: "Wave height",
  wave_period: "Wave period",
  water_temperature: "Water temperature",
};
export function formatMetric(metric, units = "metric") {
  if (!Number.isFinite(metric?.value)) return t("Unavailable");
  let value = metric.value,
    unit = metric.unit;
  if (units === "imperial") {
    if (unit === "°C") {
      value = (value * 9) / 5 + 32;
      unit = "°F";
    }
    if (unit === "km/h") {
      value /= 1.609344;
      unit = "mph";
    }
    if (unit === "mm") {
      value /= 25.4;
      unit = "in";
    }
  }
  if (unit === "m" && value >= 1000) {
    value /= 1000;
    unit = "km";
  }
  return `${Number(value.toFixed(unit === "in" || unit === "m³/m³" ? 2 : 1))}${["°C", "°F", "%"].includes(unit) ? "" : " "}${unit === "index" ? "" : unit}`.trim();
}
export function time(value, tz) {
  if (!Number.isFinite(new Date(value).getTime())) return t("Unavailable");
  return new Intl.DateTimeFormat(locale(), {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(value));
}
export function date(value, tz) {
  if (!Number.isFinite(new Date(value).getTime())) return t("Date unavailable");
  return new Intl.DateTimeFormat(locale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  }).format(new Date(value));
}
export function weatherKind(code) {
  if (code === 0) return "clear";
  if ([1, 2, 3].includes(code)) return "cloud";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "unknown";
}
export function condition(code) {
  const labels = {
    clear: "Clear sky",
    cloud: "Partly cloudy",
    fog: "Foggy",
    rain: "Rainy",
    snow: "Snowy",
    storm: "Thunderstorms possible",
    unknown: "Conditions unavailable",
  };
  return t(labels[weatherKind(code)]);
}
export function locationKey(loc) {
  return `${loc.latitude.toFixed(6)}:${loc.longitude.toFixed(6)}`;
}
export function offlineCopy(home) {
  const copy = structuredClone(home);
  copy.data_status.status =
    copy.data_status.status === "simulated" ? "simulated" : "cached";
  copy.data_status.offline = true;
  const calculatedAge = Math.max(
    0,
    (Date.now() - new Date(copy.data_status.retrieved_at).getTime()) / 1000,
  );
  const age = Number.isFinite(calculatedAge) ? calculatedAge : Infinity;
  if (copy.data_status.status !== "simulated") {
    copy.data_status.age_seconds = age;
    copy.data_status.freshness =
      age > 10800 ? "expired" : age > 900 ? "stale" : "fresh";
  }
  for (const point of [copy.current_weather, ...copy.hourly])
    for (const metric of Object.values(point.metrics)) {
      if (metric.status !== "unavailable" && metric.status !== "simulated")
        metric.status = "cached";
    }
  for (const metrics of [
    copy.air_quality,
    copy.marine,
    ...copy.daily.map((x) => x.metrics),
  ])
    for (const metric of Object.values(metrics)) {
      if (metric.status !== "unavailable" && metric.status !== "simulated")
        metric.status = "cached";
    }
  // Offline recommendations cannot be refreshed. Remove expired real-world guidance.
  if (copy.data_status.status !== "simulated") {
    copy.personalized_sections = copy.personalized_sections
      .filter((x) => new Date(x.expires_at) > new Date())
      .map((x) => ({ ...x, status: "cached", quality: "low" }));
    copy.today_for_you = copy.today_for_you
      .filter((x) => new Date(x.expires_at) > new Date())
      .map((x) => ({ ...x, status: "cached", quality: "low" }));
    copy.priority_alerts = copy.priority_alerts
      .filter((x) => new Date(x.end_time) > new Date())
      .map((x) => ({ ...x, status: "cached" }));
  }
  if (copy.data_status.status !== "simulated") {
    // Plans are perishable assessments; require a connection to refresh them.
    copy.planning = {};
    if (age > 10800) {
      copy.priority_alerts = [];
      copy.personalized_sections = [];
      copy.today_for_you = [];
    }
  }
  if (copy.data_status.status !== "simulated") {
    // Risk/safety may expire sooner than the raw forecast; never preserve a stale emergency.
    const valid =
      copy.weather_risk?.expires_at &&
      new Date(copy.weather_risk.expires_at) > new Date() &&
      age <= 10800;
    if (valid) {
      copy.weather_risk.status = "cached";
      copy.safety.status = "cached";
      copy.weather_risk.components?.forEach((component) => {
        component.status = "cached";
      });
      copy.safety.hazards?.forEach((hazard) => {
        hazard.status = "cached";
      });
    } else {
      copy.weather_risk = {
        score: null,
        category: "unavailable",
        components: [],
        missing: [],
        coverage: "unavailable",
        status: "unavailable",
      };
      copy.safety = {
        emergency: false,
        hazards: [],
        official_warnings: [],
        status: "unavailable",
      };
      copy.homepage_layout =
        copy.homepage_layout?.filter(
          (widget) => widget.widget_id !== "safety",
        ) || [];
    }
    copy.homepage_layout?.forEach((widget) => {
      widget.status = "cached";
    });
  }
  return copy;
}
