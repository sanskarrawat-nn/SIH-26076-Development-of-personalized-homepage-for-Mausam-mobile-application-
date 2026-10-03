import { t, setLanguage } from "../services/i18n";
import React from "react";
import { FlaskConical, RotateCcw, ArrowRight } from "lucide-react";
export const SCENARIOS = {
  student_commute: "Student Commute",
  hill_fog: "Hill Fog",
  community_flood: "Community Flood Report",
  verified_community: "Verified Community Report",
  route_rain: "Route Heavy Rain",
  emergency: "Emergency Mode",
  severe_aqi: "Severe AQI",
  official_warning: "Official Warning (SIMULATED)",
  hindi_voice: "Hindi Voice Example",
  pleasant: "Pleasant day",
  heat: "Extreme heat",
  heat_no_window: "Extreme heat: no outdoor window",
  rain: "Heavy rain",
  air: "Poor air quality",
  fog: "Foggy morning",
  travel_rain: "Destination rain",
  agriculture_rain: "Agricultural rainfall",
  frost: "Overnight frost",
  storm: "Thunderstorm",
  coast: "Coastal day",
  pollen: "Pollen demonstration",
  missing: "No available data",
};
export default function JudgeMode({
  scenario,
  setScenario,
  setProfile,
  profile,
  onReset,
  onAsk,
}) {
  return (
    <section className="judge-panel">
      <div className="judge-title">
        <FlaskConical size={21} />
        <div>
          <strong>{t("Judge Mode")}</strong>
          <p>{t("Same conditions. Different decisions.")}</p>
        </div>
        <button className="text-btn" onClick={onReset}>
          <RotateCcw size={16} />
          {t("Reset")}
        </button>
      </div>
      <div className="judge-controls">
        <label>
          {t("Weather scenario")}
          <select
            value={scenario}
            onChange={(e) => {
              const value = e.target.value;
              setScenario(value);
              const persona = {
                student_commute: "student",
                hill_fog: "hill",
                route_rain: "travel",
              }[value];
              if (persona) setProfile({ ...profile, interests: [persona] });
              if (value === "hindi_voice") {
                setLanguage("hi");
                setProfile({ ...profile, interests: ["fitness", "health"] });
              }
            }}
          >
            {Object.entries(SCENARIOS).map(([key, label]) => (
              <option key={key} value={key}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="field-label">{t("60-second walkthrough")}</span>
          <div className="demo-steps">
            {[
              ["Fitness + Health", ["fitness", "health"], "heat"],
              ["Agriculture", ["agriculture"], "agriculture_rain"],
              ["Student", ["student"], "student_commute"],
              ["Family", ["family"], "rain"],
              ["Emergency Override", ["family"], "emergency"],
              ["Hindi Ask Mausam", ["fitness", "health"], "hindi_voice"],
            ].map(([label, interests, nextScenario], i) => (
              <button
                key={label}
                onClick={() => {
                  setProfile({ ...profile, interests });
                  setScenario(nextScenario);
                  if (nextScenario === "hindi_voice") {
                    setLanguage("hi");
                    onAsk();
                  }
                }}
              >
                <span>{i + 1}</span>
                {t(label)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="small muted">
        {t(
          "Controlled demonstration · 15 June 2026 · All numbers are simulated. Open “Why this for me?” to inspect ranking.",
        )}
      </p>
    </section>
  );
}
