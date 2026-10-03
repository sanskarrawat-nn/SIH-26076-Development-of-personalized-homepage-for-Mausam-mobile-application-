import { t } from "../services/i18n";
import React from "react";
import {
  ArrowUpRight,
  Info,
  Clock,
  Leaf,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { PERSONAS } from "./Personas";
import { formatMetric, LABELS, time } from "../services/format";
import { Badge, Empty } from "./ui";
export function InsightCard({
  item,
  data,
  units,
  onWhy,
  onFeedback,
  featured = false,
}) {
  const Icon = PERSONAS[item.personas[0]]?.icon || Leaf;
  const metrics = {
    ...data.current_weather.metrics,
    ...data.air_quality,
    ...data.marine,
  };
  return (
    <article className={`insight panel ${featured ? "featured" : ""}`}>
      <div className="insight-top">
        <span className="card-icon">
          <Icon size={21} />
        </span>
        <span className="eyebrow">
          {item.personas.map((p) => t(PERSONAS[p].label)).join(" + ")}
        </span>
        <span className="priority-label">
          {t(featured ? "TOP PICK" : "FOR YOU")}
        </span>
      </div>
      <h3>{t(item.title)}</h3>
      {item.window_start && (
        <div className="window">
          <Clock size={20} />
          {time(item.window_start, data.location.timezone)} –{" "}
          {time(item.window_end, data.location.timezone)}
          <small>
            {new Date(item.window_start).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              timeZone: data.location.timezone,
            })}
          </small>
        </div>
      )}
      <p>{t(item.message)}</p>
      <div className="insight-metrics">
        {item.metrics.slice(0, 3).map((key) => (
          <div key={key}>
            <small>{t(LABELS[key])}</small>
            <strong>{formatMetric(metrics[key], units)}</strong>
          </div>
        ))}
      </div>
      <div className="feedback-controls">
        <button
          className="text-btn"
          onClick={() => onFeedback?.(item, "useful")}
        >
          {t("Useful")}
        </button>
        <button
          className="text-btn"
          onClick={() => onFeedback?.(item, "not_useful")}
        >
          {t("Not Useful")}
        </button>
      </div>
      <button className="why-button" onClick={() => onWhy(item)}>
        <Info size={16} />
        {t("Why this for me?")}
        <ArrowUpRight size={17} />
      </button>
    </article>
  );
}
export default function Insights({ data, units, onWhy, onFeedback }) {
  const items = data.personalized_sections;
  return (
    <section id="for-you">
      <div className="section-head">
        <div>
          <span className="eyebrow">{t("YOUR WEATHER, INTERPRETED")}</span>
          <h2>
            {t("Today, for you")}
            <span className="accent-dot">.</span>
          </h2>
        </div>
        <span className="muted small">{t("Shaped by your interests")}</span>
      </div>
      {!items.length ? (
        <Empty title={t("Your next decision starts here")}>
          {data.data_status.status === "unavailable"
            ? t(
                "Weather data is unavailable. We won’t invent a recommendation.",
              )
            : t("Choose an interest above to personalize your day.")}
        </Empty>
      ) : (
        <div className="insight-grid">
          {items.slice(0, 2).map((item, i) => (
            <InsightCard
              key={item.id}
              item={item}
              data={data}
              units={units}
              onWhy={onWhy}
              onFeedback={onFeedback}
              featured={i === 0}
            />
          ))}
        </div>
      )}
      {items.length > 2 && (
        <details className="more-insights">
          <summary>
            {t("More for your day (")}
            {items.length - 2})
          </summary>
          <div className="insight-grid">
            {items.slice(2).map((item) => (
              <InsightCard
                key={item.id}
                item={item}
                data={data}
                units={units}
                onWhy={onWhy}
                onFeedback={onFeedback}
              />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
export function Explanation({ item, data, judge }) {
  const metrics = {
    ...data.current_weather.metrics,
    ...data.air_quality,
    ...data.marine,
  };
  return (
    <div className="explanation">
      <Badge status={item.status} />
      <h3>{t(item.title)}</h3>
      <p className="muted">{t("Here’s what shaped this suggestion.")}</p>
      <section className="explanation-group">
        <h3>{t("Your context")}</h3>
        <dl>
          <div>
            <dt>{t("Your interests")}</dt>
            <dd>
              {item.personas.map((p) => t(PERSONAS[p]?.label || p)).join(" + ")}
            </dd>
          </div>
          <div>
            <dt>{t("Activity")}</dt>
            <dd>{t(item.rule_metadata?.activity || "general")}</dd>
          </div>
          <div>
            <dt>{t("Location")}</dt>
            <dd>{data.location.name}</dd>
          </div>
        </dl>
      </section>
      <section className="explanation-group">
        <h3>{t("What this means for you")}</h3>
        <p>{t(item.message)}</p>
        {item.window_start && (
          <p className="window">
            <Clock size={18} />
            {time(item.window_start, data.location.timezone)}–
            {time(item.window_end, data.location.timezone)}
          </p>
        )}
        <div className="explanation-scores">
          <div>
            <span>{t("Weather risk:")}</span>
            <strong>
              {data.weather_risk?.score ?? t("Unavailable")} / 100
            </strong>
          </div>
          <div>
            <span>{t("Personalized relevance:")}</span>
            <strong>{item.priority} / 100</strong>
          </div>
        </div>
        <p className="muted small">
          {t(
            "These are separate scores. Relevance is not a probability of safety.",
          )}
        </p>
        {data.safety?.emergency && (
          <p>{t("Safety warnings always come first.")}</p>
        )}
      </section>
      <section className="explanation-group">
        <h3>{t("Weather factors")}</h3>
        <dl>
          {item.metrics.slice(0, 3).map((key) => (
            <div key={key}>
              <dt>{t(LABELS[key] || key)}</dt>
              <dd>{formatMetric(metrics[key], "metric")}</dd>
            </div>
          ))}
        </dl>
        <details>
          <summary>{t("All factors and reasons")}</summary>
          <ul>
            {item.reasons.map((reason, i) => (
              <li key={i}>
                <ShieldCheck size={18} />
                <span>{t(reason)}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className="explanation-group">
        <h3>{t("Source and freshness")}</h3>
        <p>{item.source}</p>
        <p className="small">
          {t("Data coverage:")} {t(item.quality)} · {t("Valid through")}{" "}
          {time(item.expires_at, data.location.timezone)} ·{" "}
          {new Date(item.timestamp).toLocaleDateString(undefined, {
            timeZone: data.location.timezone,
          })}
        </p>
      </section>
      <details open={judge}>
        <summary>
          {t("Priority:")} {item.priority} / 100 · {t("Calculation details")}
        </summary>
        <p className="muted small">
          {t("A rule-based ranking, not a probability of safety.")}
        </p>
        {Object.entries(item.score_breakdown).map(([key, value]) => (
          <div className="score-row" key={key}>
            <span>{t(key)}</span>
            <span className="muted">
              {t(value < 0 ? "Reduces relevance" : "Adds relevance")}
            </span>
            <strong>{value}</strong>
          </div>
        ))}
        <p>
          {t("Rule:")} {item.rule_metadata?.rule_id} {t("· Version")}{" "}
          {item.rule_metadata?.version}
        </p>
        <p>
          {t("Data age (seconds):")} {item.rule_metadata?.freshness_seconds}
        </p>
        <details>
          <summary>{t("Rule inputs and thresholds")}</summary>
          <pre className="rule-json">
            {JSON.stringify(item.rule_metadata, null, 2)}
          </pre>
        </details>
      </details>
    </div>
  );
}
