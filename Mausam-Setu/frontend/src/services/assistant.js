import { formatMetric, time } from "./format.js";
import { t, getLanguage } from "./i18n.js";

function localDay(value, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

// Intentionally bounded intents: no LLM and no invented weather or implicit city switch.
export function answerQuestion(query, data, profile) {
  const text = query.toLowerCase().trim();
  if (
    !data ||
    data.data_status.status === "unavailable" ||
    data.data_status.freshness === "expired"
  )
    return t(
      "Weather data is unavailable. Reconnect or choose explicit Demo Mode.",
    );
  if (text.length > 300) return t("Please ask a shorter question.");
  const namedCities = [
    "delhi",
    "lucknow",
    "mumbai",
    "chennai",
    "kolkata",
    "bengaluru",
    "दिल्ली",
    "लखनऊ",
    "मुंबई",
  ];
  const aliases = { दिल्ली: "delhi", लखनऊ: "lucknow", मुंबई: "mumbai" };
  const mentioned = namedCities.find((name) => text.includes(name));
  if (
    mentioned &&
    !data.location.name.toLowerCase().includes(aliases[mentioned] || mentioned)
  )
    return t("Select that location first. I only use weather for {place}.", {
      place: data.location.name,
    });
  const status = t(
    data.data_status.status === "simulated"
      ? "DEMO — simulated conditions"
      : data.data_status.status,
  );
  const prefix = `${status} · ${data.location.name}. `;
  if (/flight|airport|फ्लाइट|विमान/.test(text))
    return (
      prefix +
      t(
        "Use the flight journey planner with airports and departure times. Current visibility cannot predict a flight delay.",
      )
    );
  if (/map|नक्शा/.test(text))
    return { action: "map", text: t("Opening the weather map.") };
  if (/forecast|पूर्वानुमान/.test(text) && !/rain|running/.test(text))
    return { action: "forecast", text: t("Opening your forecast.") };
  if (/preferences|settings|सेटिंग/.test(text))
    return { action: "settings", text: t("Opening preferences.") };
  if (
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\d{4}-\d{2}-\d{2}|परसों|day after/.test(
      text,
    )
  )
    return (
      prefix +
      t(
        "For exact dates and times, use Your plans. I support today, tomorrow and morning summaries.",
      )
    );
  const tomorrow = /tomorrow|kal|कल/.test(text);
  const reference = new Date(data.reference_time);
  const calendar = new Date(
    localDay(reference, data.location.timezone) + "T12:00:00Z",
  );
  calendar.setUTCDate(calendar.getUTCDate() + (tomorrow ? 1 : 0));
  const targetDay = calendar.toISOString().slice(0, 10);
  let points = data.hourly.filter(
    (point) =>
      localDay(point.time, data.location.timezone) === targetDay &&
      new Date(point.time) >= reference,
  );
  if (/morning|सुबह/.test(text))
    points = points.filter((point) => {
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: data.location.timezone,
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date(point.time)),
      );
      return hour >= 5 && hour < 12;
    });
  if (/running|run|workout|दौड़|व्यायाम/.test(text)) {
    const session =
      tomorrow && /morning|सुबह/.test(text)
        ? data.planning?.fitness_tomorrow_morning
        : data.planning?.fitness;
    if (
      !session?.available ||
      (tomorrow &&
        localDay(session.start, data.location.timezone) !== targetDay)
    )
      return (
        prefix +
        t(
          "No matching workout window is available for that day. Update your fitness preferences and inspect Your plans.",
        )
      );
    const sessionHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: data.location.timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date(session.start)),
    );
    if (/morning|सुबह/.test(text) && sessionHour >= 12)
      return (
        prefix +
        t(
          "No matching workout window is available for that day. Update your fitness preferences and inspect Your plans.",
        )
      );
    return (
      prefix +
      t(
        "Based on the loaded forecast and your workout settings: {start}–{end}. This is a screened window, not a safety guarantee. Recheck conditions before leaving.",
        {
          start: time(session.start, data.location.timezone),
          end: time(session.end, data.location.timezone),
        },
      )
    );
  }
  if (/college|school|commute|कॉलेज|स्कूल/.test(text))
    return (
      prefix +
      t(
        "Set your journey or school times in Your plans; I cannot infer your route or departure time.",
      )
    );
  const metricKey = /rain|baarish|barish|बारिश|वर्षा/.test(text)
    ? "rain_probability"
    : /visibility|दृश्यता/.test(text)
      ? "visibility"
      : /temperature|hot|तापमान|गर्मी/.test(text)
        ? "temperature"
        : null;
  if (metricKey) {
    const values = points
      .map((p) => p.metrics[metricKey])
      .filter((m) => m?.value != null && m.status !== "unavailable");
    if (!values.length || values.length !== points.length)
      return (
        prefix + t("Complete forecast coverage is unavailable for that period.")
      );
    const value =
      metricKey === "visibility"
        ? Math.min(...values.map((m) => m.value))
        : Math.max(...values.map((m) => m.value));
    return (
      prefix +
      `${targetDay}: ` +
      t(
        metricKey === "rain_probability"
          ? "Peak rain chance"
          : metricKey === "visibility"
            ? "Lowest visibility"
            : "Highest temperature",
      ) +
      `: ${formatMetric({ ...values[0], value }, profile.units)}. ` +
      t("Forecast estimate for the selected period, not a guarantee.")
    );
  }
  if (/weather|mausam|मौसम|summary/.test(text))
    return (
      prefix +
      t("Temperature") +
      `: ${formatMetric(data.current_weather.metrics.temperature, profile.units)}. ` +
      t("Weather risk") +
      `: ${data.weather_risk?.score ?? t("Unavailable")}/100. ` +
      (data.safety?.emergency
        ? t("Review Emergency mode first.")
        : t("Check Your plans for personalized guidance."))
    );
  return t(
    "Try: tomorrow rain, morning running, temperature, visibility, open map, or open settings.",
  );
}

export function speak(text) {
  if (
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    typeof window.SpeechSynthesisUtterance !== "function"
  )
    return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = getLanguage() === "hi" ? "hi-IN" : "en-IN";
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
