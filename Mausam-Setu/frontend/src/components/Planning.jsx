import { t } from "../services/i18n";
import React from "react";
import { CalendarDays } from "lucide-react";
import { formatMetric, LABELS } from "../services/format";
import PlanForm from "./planning/PlanForm";
import Summary from "./planning/PlanSummary";
import JourneyPlanner from "./planning/JourneyPlanner";
import TidePlanner from "./planning/TidePlanner";
import { SlidersHorizontal } from "lucide-react";

export default function Planning({
  data,
  profile,
  setProfile,
  location,
  mode,
  scenario,
  saved,
  setSaved,
}) {
  const plans = data.planning || {};
  const has = (p) => profile.interests.includes(p);
  const metrics = { ...data.current_weather.metrics, ...data.air_quality };
  return (
    <section className="panel planning-panel" id="plans">
      <div className="section-head">
        <div>
          <span className="eyebrow">{t("MAKE THE FORECAST PERSONAL")}</span>
          <h2>{t("Your plans")}</h2>
        </div>
        <CalendarDays size={24} />
      </div>
      <details className="planner-details">
        <summary>
          <SlidersHorizontal size={17} />
          {t("Customize my plans")}
        </summary>
        <PlanForm profile={profile} setProfile={setProfile} />
      </details>
      <div className="plan-grid">
        {plans.fitness && (
          <Summary
            title={t("Your activity session")}
            item={plans.fitness}
            tz={location.timezone}
          />
        )}{" "}
        {plans.school?.map((r) => (
          <Summary
            key={r.label}
            title={r.label}
            item={r}
            tz={location.timezone}
          />
        ))}
        {plans.event && (
          <Summary
            title={t("Event outlook")}
            item={plans.event}
            tz={location.timezone}
          />
        )}
        {plans.planting && (
          <article className="plan-result">
            <h3>{t("Planting calendar")}</h3>
            <p>{t(plans.planting.message)}</p>
            <p className="muted small">{t(plans.planting.caution)}</p>
            {plans.planting.source && (
              <a href={plans.planting.source} target="_blank" rel="noreferrer">
                {t("Read the crop guidance")}
              </a>
            )}
          </article>
        )}
        {(has("health") || has("agriculture")) && (
          <article className="plan-result">
            <h3>
              {has("health") && has("agriculture")
                ? t("Pollen & soil")
                : has("health")
                  ? t("Pollen counts")
                  : t("Soil moisture")}
            </h3>
            {[
              ...(has("health")
                ? ["grass_pollen", "birch_pollen", "alder_pollen"]
                : []),
              ...(has("agriculture")
                ? ["soil_moisture", "soil_moisture_root"]
                : []),
            ].map((k) => (
              <div className="plan-metric" key={k}>
                <span>{t(LABELS[k])}</span>
                <strong>{formatMetric(metrics[k], profile.units)}</strong>
              </div>
            ))}
            <p className="muted small">
              {has("health") && data.data_status.pollen === "unavailable"
                ? t("Pollen data unavailable for this location.")
                : ""}
              {has("agriculture")
                ? t(
                    "Soil values are model estimates by depth, not a field measurement or irrigation dose. ",
                  )
                : ""}
              {data.data_status.status === "simulated"
                ? t("Displayed values are simulated.")
                : ""}
            </p>
          </article>
        )}
      </div>
      {(has("travel") || has("commute") || has("family")) && (
        <JourneyPlanner
          key={`journey:${mode}:${scenario}:${location.latitude}:${location.longitude}`}
          {...{ location, data, mode, scenario, saved, setSaved }}
        />
      )}
      {has("marine") && (
        <TidePlanner
          key={`tide:${mode}:${scenario}:${location.latitude}:${location.longitude}`}
          {...{ location, data, mode }}
        />
      )}
      <p className="muted small">
        {t("Times use")}
        {location.timezone}.{" "}
        <a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer">
          {t("Official IMD warnings")}
        </a>{" "}
        ·{" "}
        <a href="https://incois.gov.in/" target="_blank" rel="noreferrer">
          {t("INCOIS coastal advisories")}
        </a>
      </p>
    </section>
  );
}
