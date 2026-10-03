import { t } from "../../services/i18n";
import React, { useState } from "react";
import { Badge } from "../ui";
import { Moment } from "./PlanSummary";
import Field from "./Field";
import { localDateTimeInput } from "../../services/dates";
import { usePlannerRequest } from "../../hooks/usePlannerRequest";

export default function TidePlanner({ location, data, mode }) {
  const [day, setDay] = useState(
    localDateTimeInput(data.reference_time, location.timezone).slice(0, 10),
  );
  const { result, busy, error, run } = usePlannerRequest(
    JSON.stringify([location, day, mode]),
  );
  return (
    <details className="planner-details">
      <summary>{t("High & low tides")}</summary>
      <p className="muted small">
        {t(
          "For coastal locations. Tide height uses the provider’s reference datum.",
        )}
      </p>
      <form
        className="inline-plan"
        onSubmit={(e) => {
          e.preventDefault();
          run("/api/planner/tides", { location, day, mode });
        }}
      >
        <Field label={t("Tide date")}>
          <input
            type="date"
            required
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>
        <button className="btn" disabled={busy}>
          {busy ? t("Loading tides…") : t("Check tides")}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && (
        <article className="plan-result">
          <Badge status={result.status} />
          <h3>
            {result.status === "simulated"
              ? t("DEMO TIDE")
              : result.status === "unavailable"
                ? t("Live tide data unavailable.")
                : t("Live provider tide predictions · ESTIMATED")}
          </h3>
          <p>{result.message}</p>
          {result.events && (
            <>
              <p className="small">
                {result.source} · {result.datum}
              </p>
              <div className="tide-list">
                {result.events.map((e) => (
                  <div key={e.time}>
                    <strong>{e.type}</strong>
                    <span>
                      <Moment value={e.time} tz={location.timezone} />
                    </span>
                    <span>
                      {e.height.toFixed(2)}
                      {t("m")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>
      )}
    </details>
  );
}
