import React, { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Badge } from "./ui";
import { t } from "../services/i18n";
import { time, formatMetric, LABELS } from "../services/format";

export function RiskPanel({ risk }) {
  if (!risk) return null;
  return (
    <section
      className="panel risk-panel"
      data-risk={risk.category}
      aria-labelledby="risk-title"
    >
      <div className="section-head">
        <h2 id="risk-title">{t("Weather risk")}</h2>
        <Badge status={risk.status} />
      </div>
      <p className="risk-number">
        {risk.score == null ? t("Unavailable") : `${risk.score} / 100`}{" "}
        <span>{t(risk.category)}</span>
      </p>
      {risk.score != null && (
        <progress
          className="risk-meter"
          max="100"
          value={risk.score}
          aria-label={t("Weather risk")}
        />
      )}
      <p>
        {t(
          "Prototype screening index · not an official index or a probability of safety.",
        )}
      </p>
      <p>
        {t("Next six hours, using available inputs")}. {t("Coverage")}:{" "}
        {t(risk.coverage)}.
      </p>
      {!!risk.missing?.length && (
        <p>
          {t("Missing inputs")}:{" "}
          {risk.missing.map((key) => t(LABELS[key] || key)).join(", ")}.{" "}
          {t("Missing data can underestimate risk.")}
        </p>
      )}
      <details>
        <summary>{t("How risk is calculated")}</summary>
        {risk.components?.map((item) => (
          <div className="risk-component" key={item.key}>
            <strong>{t(LABELS[item.key] || item.key)}</strong>
            <span>
              {item.points} / {item.maximum}
            </span>
            <small>
              {item.value != null ? `${item.value} ${item.unit || ""} · ` : ""}
              {item.source}
            </small>
          </div>
        ))}
        <p>{t(risk.method)}</p>
        <p>
          {t("Rule version")}: {risk.version}
        </p>
      </details>
    </section>
  );
}

export function SafetyPanel({ data, onMap }) {
  const safety = data.safety;
  const [shareMessage, setShareMessage] = useState("");
  if (!safety?.emergency && !safety?.official_warnings?.length) return null;
  const demo = safety.status === "simulated";
  const hazards = safety.hazards || [];
  const storm = hazards.some((h) => h.code === "thunderstorm");
  const actions = storm
    ? [
        "Move into a substantial enclosed building if thunderstorms approach.",
        "Avoid open fields and isolated trees.",
      ]
    : [
        "Check official local warnings before outdoor plans.",
        "Pause exposed activities and follow local authority instructions.",
      ];
  const officialText = (safety.official_warnings || [])
    .map(
      (w) =>
        `${w.authority}: ${w.title}. ${w.message} ${time(w.start_time, data.location.timezone)}–${time(w.end_time, data.location.timezone)}. ${w.source_url}`,
    )
    .join(" ");
  const shareText = `${demo ? "DEMO — " : ""}Mausam Setu · ${data.location.name} · ${safety.status}. ${officialText} ${hazards.length ? `${t("App-generated safety screening")}: ${hazards.map((h) => `${t(h.code)} ${h.value ?? ""} ${h.unit ?? ""}; ${time(h.start, data.location.timezone)}–${time(h.end, data.location.timezone)}`).join("; ")}. ${data.data_status.source}. ${t("Not an official warning")}.` : ""} ${actions.map((action) => t(action)).join(" ")}`;

  async function share() {
    try {
      if (navigator.share)
        await navigator.share({ title: "Mausam Setu", text: shareText });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setShareMessage(t("Alert copied"));
      } else setShareMessage(shareText);
    } catch (error) {
      if (error.name !== "AbortError") setShareMessage(shareText);
    }
  }
  return (
    <section className="panel emergency-panel" aria-labelledby="safety-title">
      <div className="section-head">
        <h2 id="safety-title">
          <TriangleAlert aria-hidden="true" />{" "}
          {t(safety.emergency ? "Emergency mode" : "Official warnings")}
        </h2>
        <Badge status={safety.status} />
      </div>
      <strong>
        {demo
          ? t("DEMO — simulated conditions")
          : t("App-generated safety screening")}
      </strong>
      <h3>{data.location.name}</h3>
      <p>
        {t("Not an official warning")}.{" "}
        {t("Review the source and validity before acting.")}
      </p>
      <ul>
        {hazards.map((h) => (
          <li key={h.rule_id}>
            <strong>{t(LABELS[h.code] || h.code)}</strong>: {h.value} {h.unit} ·{" "}
            {time(h.start, data.location.timezone)}–
            {time(h.end, data.location.timezone)}
            <small>{h.source}</small>
          </li>
        ))}
      </ul>
      {safety.official_warnings?.map((warning) => (
        <article key={warning.id}>
          <h3>
            {warning.authority}: {warning.title}
          </h3>
          <p>{warning.message}</p>
          <a href={warning.source_url} target="_blank" rel="noreferrer">
            {t("Original warning")}
          </a>
        </article>
      ))}
      <h3>{t("What you should do")}</h3>
      <ul>
        {actions.map((action) => (
          <li key={action}>{t(action)}</li>
        ))}
      </ul>
      {storm && (
        <a
          href="https://www.weather.gov/safety/lightning-tips"
          target="_blank"
          rel="noreferrer"
        >
          {t("Lightning safety reference")}
        </a>
      )}
      <div className="safety-actions">
        <button className="btn" onClick={onMap}>
          {t("Weather map")}
        </button>
        <a
          className="btn"
          href="https://mausam.imd.gov.in/"
          target="_blank"
          rel="noreferrer"
        >
          {t("Official IMD warnings")}
        </a>
        <button className="btn" onClick={share}>
          {t("Share alert")}
        </button>
      </div>
      <p className="small">
        {t("The weather map is not an evacuation or safe-route map.")}
      </p>
      <details>
        <summary>{t("Emergency contacts")}</summary>
        <p>
          {t("India emergency response")}: <a href="tel:112">112</a>.{" "}
          {t("Outside India, use your local emergency number.")}
        </p>
      </details>
      <p role="status">{shareMessage}</p>
    </section>
  );
}

export function MetricPanel({ data, kind, units }) {
  const marine = kind === "marine";
  const metrics = marine ? data.marine : data.current_weather.metrics;
  const keys = marine
    ? ["wave_height", "wave_period", "water_temperature"]
    : ["soil_moisture", "soil_moisture_root"];
  return (
    <section className="panel metric-panel">
      <h2>{t(marine ? "Marine conditions" : "Soil moisture")}</h2>
      {keys.map((key) => (
        <div className="plan-metric" key={key}>
          <span>{t(LABELS[key])}</span>
          <strong>{formatMetric(metrics[key], units)}</strong>
          <Badge status={metrics[key]?.status || "unavailable"} />
        </div>
      ))}
    </section>
  );
}
