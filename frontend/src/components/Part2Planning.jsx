import { dispatchNotifications } from "../services/notifications";
import React, { useEffect, useState } from "react";
import { post } from "../services/api";
import { readLocal, saveLocal } from "../services/storage";
import { DEFAULT_PLANNING, validLocation } from "../services/preferences";
import { formatMetric } from "../services/format";
import { t } from "../services/i18n";

function WindowCard({ window: w, timezone }) {
  return (
    <article className="part2-card">
      <strong>{t(w.label || "Weather window")}</strong>
      <p>
        {w.start
          ? new Date(w.start).toLocaleString("en-IN", { timeZone: timezone })
          : ""}
      </p>
      <p>{t(w.message || "Unavailable")}</p>
      {w.aqi && <small>{t(w.aqi)}</small>}
    </article>
  );
}
export function ScheduleExtras({ data, profile, setProfile }) {
  const planning = { ...DEFAULT_PLANNING, ...profile.planning };
  const update = (key, value) =>
    setProfile({ ...profile, planning: { ...planning, [key]: value } });
  const sections = data.planning || {};
  return (
    <div className="part2-panel">
      <details>
        <summary>{t("Student, commute and crop settings")}</summary>
        <div className="part2-grid">
          {[
            "student_start",
            "student_end",
            "practice_time",
            "commute_departure",
            "commute_return",
          ].map((key) => (
            <label key={key}>
              {t(
                {
                  student_start: "College starts",
                  student_end: "College ends",
                  practice_time: "Practice time",
                  commute_departure: "Usual departure",
                  commute_return: "Usual return",
                }[key],
              )}
              <input
                type="time"
                value={planning[key]}
                onChange={(e) => {
                  if (e.target.value) update(key, e.target.value);
                }}
              />
            </label>
          ))}
          <label>
            {t("Outdoor activity")}
            <select
              value={planning.student_activity}
              onChange={(e) => update("student_activity", e.target.value)}
            >
              {["sports", "walking", "none"].map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Commute minutes")}
            <input
              type="number"
              min="5"
              max="240"
              value={planning.commute_minutes}
              onChange={(e) => {
                const v = +e.target.value;
                if (v >= 5 && v <= 240) update("commute_minutes", v);
              }}
            />
          </label>
          <label>
            {t("Transport mode")}
            <select
              value={planning.transport_mode}
              onChange={(e) => update("transport_mode", e.target.value)}
            >
              {["car", "bicycle", "pedestrian", "bus", "motorcycle"].map(
                (k) => (
                  <option key={k} value={k}>
                    {t(k)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            {t("Growth stage")}
            <select
              value={planning.growth_stage}
              onChange={(e) => update("growth_stage", e.target.value)}
            >
              {[
                "unspecified",
                "seedling",
                "vegetative",
                "flowering",
                "maturity",
              ].map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      {["student", "commute"].map(
        (key) =>
          sections[key] && (
            <div key={key}>
              <h3>
                {t(key === "student" ? "Student schedule" : "Commute schedule")}
              </h3>
              <div className="part2-grid">
                {sections[key].map((w) => (
                  <WindowCard
                    key={w.label}
                    window={w}
                    timezone={data.location.timezone}
                  />
                ))}
              </div>
            </div>
          ),
      )}
      {sections.play && (
        <div>
          <h3>{t("Child outdoor play window")}</h3>
          <WindowCard
            window={sections.play}
            timezone={data.location.timezone}
          />
          <small>{sections.play.scope}</small>
        </div>
      )}
      {sections.hill && (
        <article className="part2-card">
          <h3>{t("Hill outlook")}</h3>
          <p>
            {t("Forecast rain over 24 hours")}:{" "}
            {sections.hill.forecast_rain_24h_mm ?? "Unavailable"} mm
          </p>
          <p>{sections.hill.message}</p>
        </article>
      )}
      {sections.agriculture && (
        <article className="part2-card">
          <h3>{t("Crop weather")}</h3>
          <p>
            {t("Forecast rain over 24 hours")}:{" "}
            {sections.agriculture.forecast_rain_24h_mm ?? "Unavailable"} mm
          </p>
          <p>{sections.agriculture.message}</p>
          <p>{sections.agriculture.irrigation}</p>
          <p>
            {t("Growth stage")}: {sections.agriculture.growth_stage}
          </p>
        </article>
      )}
      {sections.coastal && (
        <article className="part2-card">
          <h3>{t("Coastal screening")}</h3>
          <p>
            {sections.coastal.status.toUpperCase()} ·{" "}
            {sections.coastal.score ?? "Unavailable"}/100
          </p>
          <p>{sections.coastal.message}</p>
          <small>{sections.coastal.formula}</small>
          <p>{sections.coastal.tides}</p>
          <a href="https://incois.gov.in/" target="_blank" rel="noreferrer">
            INCOIS
          </a>
        </article>
      )}
      {sections.exposure && (
        <details>
          <summary>{t("Exposure time windows")}</summary>
          <p>
            {sections.exposure.aqi_scale} · {t("Current")}:{" "}
            {sections.exposure.current_us_aqi ?? "Unavailable"}
          </p>
          <div className="part2-grid">
            {sections.exposure.windows.map((w) => (
              <WindowCard
                key={w.label}
                window={w}
                timezone={data.location.timezone}
              />
            ))}
          </div>
          <small>{sections.exposure.scope}</small>
        </details>
      )}
      <details>
        <summary>{t("Next six hours")}</summary>
        <p>{t("Hourly model forecast, not official IMD nowcast.")}</p>
        {sections.near_term?.map((p) => (
          <p key={p.at}>
            {new Date(p.at).toLocaleTimeString(undefined, {
              timeZone: data.location.timezone,
            })}{" "}
            · {formatMetric(p.precipitation, profile.units)} ·{" "}
            {formatMetric(p.rain_probability, profile.units)}
          </p>
        ))}
      </details>
    </div>
  );
}
export default function SavedPlans({
  location,
  mode,
  scenario,
  data,
  lowData,
}) {
  const [plans, setPlans] = useState(() => {
    const v = readLocal("mausam.plans", []);
    return Array.isArray(v)
      ? v
          .filter(
            (p) =>
              p &&
              typeof p.id === "string" &&
              typeof p.activity === "string" &&
              validLocation(p.location) &&
              Number.isFinite(Date.parse(p.start)) &&
              Number.isFinite(p.hours) &&
              p.hours >= 0.5 &&
              p.hours <= 24,
          )
          .slice(0, 5)
      : [];
  });
  const [activity, setActivity] = useState("Football practice"),
    [start, setStart] = useState(""),
    [hours, setHours] = useState(1),
    [backup, setBackup] = useState(false);
  const [results, setResults] = useState({}),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    saveLocal("mausam.plans", plans);
  }, [plans]);
  useEffect(() => {
    const controller = new AbortController();
    async function evaluate() {
      const next = {};
      for (const plan of plans) {
        const key = `mausam.plan-result.${plan.id}.${mode}.${scenario}`;
        const cache = readLocal(key, null);
        if (
          !navigator.onLine ||
          (lowData && cache && Date.now() - cache.saved < 1800000)
        ) {
          next[plan.id] =
            cache &&
            (cache.result.status === "simulated" ||
              (Date.now() - cache.saved < 10800000 &&
                Date.parse(cache.result.end) > Date.now()))
              ? {
                  ...cache.result,
                  status:
                    cache.result.status === "simulated"
                      ? "simulated"
                      : "cached",
                  offline: !navigator.onLine,
                }
              : {
                  message: "No saved evaluation available.",
                  status: "unavailable",
                };
          continue;
        }
        try {
          const result = await post(
            "/api/planner/evaluate",
            { ...plan, mode, scenario },
            controller.signal,
          );
          next[plan.id] = result;
          saveLocal(key, { result, saved: Date.now() });
        } catch {
          if (controller.signal.aborted) return;
          next[plan.id] = {
            message: "Evaluation unavailable. Reconnect to recheck.",
            status: "unavailable",
          };
        }
      }
      if (!controller.signal.aborted) {
        setResults(next);
        if (navigator.onLine)
          dispatchNotifications(
            Object.entries(next)
              .filter(
                ([, r]) => r.available && r.concerns?.length && !r.offline,
              )
              .map(([id, r]) => ({
                id: `saved-plan:${id}:${r.start}`,
                category: "event",
                severity: r.concerns.includes("Thunderstorms")
                  ? "warning"
                  : "caution",
                status: r.status,
                expires_at: r.end,
                message: `${r.activity}: ${r.message}`,
              })),
          );
      }
    }
    setResults({});
    evaluate();
    return () => controller.abort();
  }, [plans, mode, scenario, data.data_status.retrieved_at, lowData, revision]);
  return (
    <section className="panel part2-panel" id="saved-plans">
      <h2>{t("Weather-aware plans")}</h2>
      <p className="muted">
        {t(
          "Save up to five plans on this device. Weather is checked for the entire duration when this dashboard refreshes.",
        )}
      </p>
      <details>
        <summary>{t("Add a plan")}</summary>
        <form
          className="part2-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (plans.length >= 5) {
              setMessage(t("Remove a plan before adding another."));
              return;
            }
            setPlans([
              ...plans,
              {
                id: crypto.randomUUID(),
                activity,
                start,
                hours,
                indoor_backup: backup,
                location,
              },
            ]);
            setMessage(t("Plan saved."));
          }}
        >
          <label>
            {t("Activity")}
            <input
              required
              maxLength="80"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            />
          </label>
          <label>
            {t("Start date and time")} ({location.timezone})
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            {t("Duration (hours)")}
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(+e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={backup}
              onChange={(e) => setBackup(e.target.checked)}
            />{" "}
            {t("Indoor backup")}
          </label>
          <p>
            {t("Location")}: {location.name}
          </p>
          <button className="btn primary">{t("Save plan")}</button>
          <p role="status">{message}</p>
        </form>
      </details>
      <div className="part2-grid">
        {plans.map((plan) => {
          const r = results[plan.id];
          return (
            <article className="part2-card" key={plan.id}>
              <h3>{plan.activity}</h3>
              <p>
                {plan.start.replace("T", " ")} · {plan.location.name} ·{" "}
                {plan.hours} h
              </p>
              <p>
                {r?.offline ? "OFFLINE · " : ""}
                {r?.status?.toUpperCase() || t("Checking…")}
              </p>
              <p>{r?.message}</p>
              <small>
                {r?.source} ·{" "}
                {r?.retrieved_at
                  ? new Date(r.retrieved_at).toLocaleString()
                  : ""}
              </small>
              <p>{r?.backup}</p>
              {r?.rain_timing?.length > 0 && (
                <p>
                  {t("Rain timing")}:{" "}
                  {r.rain_timing
                    .map((v) => new Date(v).toLocaleTimeString())
                    .join(", ")}
                </p>
              )}
              <small>{r?.aqi}</small>
              <button
                className="btn"
                onClick={() => setPlans(plans.filter((p) => p.id !== plan.id))}
              >
                {t("Remove plan")}
              </button>
            </article>
          );
        })}
      </div>
      {plans.length > 0 && (
        <button className="btn" onClick={() => setRevision((v) => v + 1)}>
          {t("Recheck plans")}
        </button>
      )}
    </section>
  );
}
