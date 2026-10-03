import React, { useEffect, useState } from "react";
import { get, post } from "../services/api";
import { readLocal, saveLocal } from "../services/storage";
import { t } from "../services/i18n";
import { formatMetric } from "../services/format";

export const REPORT_TYPES = [
  "heavy_rain",
  "waterlogging",
  "flooding",
  "dense_fog",
  "hail",
  "strong_wind",
  "thunderstorm",
  "fallen_tree",
  "extreme_heat",
  "road_blockage",
  "coastal_flooding",
];
const label = (value) => t(value.replaceAll("_", " "));
export function demoReports(location, scenario, reference) {
  if (!["community_flood", "verified_community"].includes(scenario)) return [];
  return [0, 1, 2].map((i) => ({
    report_id: `demo-${i}`,
    category: "waterlogging",
    latitude: Math.round(location.latitude * 100) / 100 + i * 0.01,
    longitude: Math.round(location.longitude * 100) / 100,
    distance_km: i + 0.5,
    approximate_location: "DEMO approximate area",
    timestamp: reference,
    expires_at: new Date(Date.parse(reference) + 14400000).toISOString(),
    verification_status:
      scenario === "verified_community"
        ? "VERIFIED LOCAL REPORT"
        : "UNVERIFIED REPORT",
    confidence_score: 45,
    confidence_basis: ["DEMO human-review fixture; not a real report."],
    source: "DEMO / JUDGE MODE",
    status: "simulated",
    description: "DEMO: waterlogging reported near a public road.",
    confirming_reports: 2,
  }));
}
export function useCommunity(location, demo, scenario, reference, lowData) {
  const key = `mausam.community.${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
  const [view, setView] = useState({ reports: [], offline: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (demo) {
      setView({
        reports: demoReports(location, scenario, reference),
        demo: true,
        retrieved_at: reference,
      });
      return;
    }
    const controller = new AbortController();
    const cached = readLocal(key, null);
    if (
      lowData &&
      cached &&
      Date.now() - Date.parse(cached.retrieved_at) < 900000
    ) {
      setView({ ...cached, cached: true });
      return;
    }
    setView({ reports: [], offline: !navigator.onLine });
    get(
      "/api/community/reports?" +
        new URLSearchParams({
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      controller.signal,
    )
      .then((result) => {
        saveLocal(key, result);
        setView(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setView({ ...cached, reports: cached?.reports || [], offline: true });
      });
    return () => controller.abort();
  }, [key, demo, scenario, reference, revision, lowData]);
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((v) => v + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  return {
    ...view,
    reports: view.reports.map((r) =>
      !demo && Date.parse(r.expires_at) <= Date.now()
        ? { ...r, verification_status: "EXPIRED REPORT" }
        : r,
    ),
    refresh: () => setRevision((v) => v + 1),
  };
}
export function CommunityMap({ reports, location }) {
  const [selected, setSelected] = useState(null);
  const live = reports.filter(
    (r) => r.verification_status !== "EXPIRED REPORT",
  );
  const span = Math.max(
    0.03,
    ...live.map((r) =>
      Math.max(
        Math.abs(r.latitude - location.latitude),
        Math.abs(r.longitude - location.longitude),
      ),
    ),
  );
  return (
    <div className="community-map">
      <p>
        {t("Approximate report map")} ·{" "}
        {t("Coarse coordinates; not for navigation")}
      </p>
      <svg
        viewBox="0 0 400 260"
        role="img"
        aria-label={t("Approximate report map")}
      >
        <rect width="400" height="260" rx="12" fill="#eff5f1" />
        <path
          d="M200 15V245M20 130H380"
          stroke="#a2b4aa"
          strokeDasharray="5 5"
        />
        <text x="210" y="125" fontSize="11">
          {t("Selected area")}
        </text>
        {live.map((r, i) => (
          <g
            key={r.report_id}
            role="button"
            tabIndex="0"
            aria-label={`${label(r.category)} ${i + 1}`}
            onClick={() => setSelected(r)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(r);
              }
            }}
          >
            <circle
              cx={200 + ((r.longitude - location.longitude) / span) * 160}
              cy={130 - ((r.latitude - location.latitude) / span) * 100}
              r="12"
              fill={
                r.verification_status === "VERIFIED LOCAL REPORT"
                  ? "#16634a"
                  : "#b95525"
              }
            />
            <text
              x={200 + ((r.longitude - location.longitude) / span) * 160}
              y={134 - ((r.latitude - location.latitude) / span) * 100}
              textAnchor="middle"
              fill="white"
              fontSize="11"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      {selected && (
        <ReportDetail
          report={
            reports.find((r) => r.report_id === selected.report_id) || selected
          }
        />
      )}
    </div>
  );
}
function ReportDetail({ report: r }) {
  return (
    <article className="part2-card">
      <strong>
        {label(r.category)} · {r.distance_km ?? "—"} km
      </strong>
      <p>
        {t(r.verification_status)} · {t("Confidence checklist")}:{" "}
        {r.confidence_score}/100
      </p>
      <p>{r.description}</p>
      <small>
        {r.approximate_location} · {new Date(r.timestamp).toLocaleString()}
      </small>
      <p className="small muted">
        {r.source} · {r.confirming_reports}{" "}
        {t("matching reports; independence unverified")}
      </p>
      <details>
        <summary>{t("Confidence checks")}</summary>
        <ul>
          {r.confidence_basis.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}
export default function Community({
  data,
  view,
  location,
  mode,
  onMap,
  lowData,
}) {
  const [category, setCategory] = useState("heavy_rain"),
    [description, setDescription] = useState(""),
    [photo, setPhoto] = useState("");
  const [stamp, setStamp] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [receipts, setReceipts] = useState(() =>
    readLocal("mausam.report-receipts", []),
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await post("/api/community/reports", {
        category,
        description,
        photo,
        location,
        timestamp: stamp
          ? new Date(stamp).toISOString()
          : new Date().toISOString(),
      });
      const next = [
        ...receipts,
        { id: result.report.report_id, token: result.delete_token },
      ].slice(-50);
      setReceipts(next);
      saveLocal("mausam.report-receipts", next);
      setDescription("");
      setPhoto("");
      setMessage(t("Report submitted. Text and photo await privacy review."));
      view.refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  const active = view.reports.filter(
    (r) => r.verification_status !== "EXPIRED REPORT",
  );
  const clusters = Object.values(
    active.reduce((all, r) => {
      const key = `${r.category}:${r.latitude.toFixed(2)}:${r.longitude.toFixed(2)}`;
      if (!all[key]) all[key] = { ...r, count: 0 };
      all[key].count++;
      return all;
    }, {}),
  );
  return (
    <section className="panel part2-panel" id="community">
      <div className="section-head">
        <div>
          <span className="eyebrow">{t("COMMUNITY OBSERVATIONS")}</span>
          <h2>{t("Conditions around you")}</h2>
        </div>
        <button className="btn" onClick={onMap}>
          {t("Report map")}
        </button>
      </div>
      <p className="muted">
        {t(
          "Official warnings take priority, followed by provider evidence, reviewed local reports, then unverified observations.",
        )}
      </p>
      <p>
        {view.demo
          ? "DEMO / JUDGE MODE"
          : view.offline
            ? "OFFLINE"
            : view.cached
              ? "CACHED"
              : "COMMUNITY"}{" "}
        · {t("Last updated")}:{" "}
        {view.retrieved_at ? new Date(view.retrieved_at).toLocaleString() : "—"}
      </p>
      <details>
        <summary>{t("Official and provider context")}</summary>
        <p>
          {t("Official warnings")}:{" "}
          {data?.safety?.official_warnings?.length
            ? data.safety.official_warnings
                .map((w) => `${w.authority}: ${w.title}`)
                .join("; ")
            : t("Unavailable")}
        </p>
        <p>
          {data?.data_status.source} · {data?.data_status.status?.toUpperCase()}{" "}
          · {t("Rain")}:{" "}
          {formatMetric(data?.current_weather.metrics.precipitation, "metric")}{" "}
          · {t("Visibility")}:{" "}
          {formatMetric(data?.current_weather.metrics.visibility, "metric")}
        </p>
        <p>
          {t(
            "Provider weather is separate evidence; it does not verify a local incident.",
          )}
        </p>
      </details>
      <div className="part2-grid">
        {clusters.map((r) => (
          <article className="part2-card" key={r.report_id}>
            <strong>{label(r.category)}</strong>
            <p>
              {r.count} {t("reports")} · ~{r.distance_km ?? "—"} km
            </p>
            <small>
              {new Date(r.timestamp).toLocaleString()} ·{" "}
              {Math.max(
                0,
                Math.floor(
                  ((view.demo ? Date.parse(view.retrieved_at) : Date.now()) -
                    Date.parse(r.timestamp)) /
                    60000,
                ),
              )}{" "}
              {t("minutes ago")} · {t(r.verification_status)} ·{" "}
              {t("Confidence checklist")}: {r.confidence_score}/100
            </small>
          </article>
        ))}
      </div>
      {!active.length && (
        <p>
          {t(
            "No active reports downloaded for this area. This does not establish safety.",
          )}
        </p>
      )}
      <button className="btn" onClick={view.refresh}>
        {t("Refresh reports")}
      </button>
      <details>
        <summary>{t("View report details")}</summary>
        {view.reports.map((r) => (
          <ReportDetail key={r.report_id} report={r} />
        ))}
      </details>
      <details>
        <summary>{t("Report local weather")}</summary>
        {mode === "demo" ? (
          <p>
            {t(
              "DEMO mode: submissions are disabled. Switch to provider mode to submit a real observation.",
            )}
          </p>
        ) : (
          <form className="part2-form" onSubmit={submit}>
            <p>
              {t(
                "Uses the selected location, rounded to about 1 km. Change your selected place or use GPS in Places before reporting. Never include names, phone numbers, faces or home addresses.",
              )}
            </p>
            <label>
              {t("Incident type")}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {REPORT_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {label(k)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Description")}
              <textarea
                maxLength="500"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label>
              {t("Observed at (device time; blank means now)")}
              <input
                type="datetime-local"
                value={stamp}
                onChange={(e) => setStamp(e.target.value)}
              />
            </label>
            {!lowData && (
              <label>
                {t("Private evidence photo (optional; under 2 MB)")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) {
                      setPhoto("");
                      return;
                    }
                    if (file.size > 2000000) {
                      setMessage(t("Photo must be under 2 MB."));
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setPhoto(reader.result);
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            )}
            <button className="btn primary" disabled={busy || view.offline}>
              {busy ? t("Submitting…") : t("Submit report")}
            </button>
          </form>
        )}
        <p role="status">{message}</p>
        {receipts.length > 0 && (
          <details>
            <summary>{t("Delete my submitted reports")}</summary>
            {receipts.map((r) => (
              <button
                className="btn"
                key={r.id}
                onClick={async () => {
                  try {
                    await post(`/api/community/reports/${r.id}/delete`, {
                      token: r.token,
                    });
                    const next = receipts.filter((v) => v.id !== r.id);
                    setReceipts(next);
                    saveLocal("mausam.report-receipts", next);
                    view.refresh();
                  } catch (e) {
                    setMessage(e.message);
                  }
                }}
              >
                {t("Delete report")} {r.id.slice(0, 8)}
              </button>
            ))}
          </details>
        )}
      </details>
    </section>
  );
}
