import { t } from "../../services/i18n";
import React, { useState, useEffect } from "react";
import Field from "./Field";
import { DEFAULT_PLANNING } from "../../services/preferences";

export default function PlanForm({ profile, setProfile }) {
  const [draft, setDraft] = useState({
    ...DEFAULT_PLANNING,
    ...profile.planning,
  });
  const [saved, setSaved] = useState(false);
  useEffect(
    () => setDraft({ ...DEFAULT_PLANNING, ...profile.planning }),
    [profile.planning],
  );
  const change = (key, value) => {
    setDraft((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };
  const input = (key, type = "text", props = {}) => (
    <input
      type={type}
      value={draft[key] ?? ""}
      onChange={(e) =>
        change(key, type === "number" ? Number(e.target.value) : e.target.value)
      }
      {...props}
    />
  );
  const select = (key, values) => (
    <select value={draft[key]} onChange={(e) => change(key, e.target.value)}>
      {values.map(([v, label]) => (
        <option key={v} value={v}>
          {t(label)}
        </option>
      ))}
    </select>
  );
  const has = (p) => profile.interests.includes(p);
  return (
    <form
      className="plan-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.preferred_end <= draft.preferred_start) {
          alert("Preferred end hour must follow the start hour.");
          return;
        }
        setProfile({
          ...profile,
          planning: {
            ...draft,
            event_date: draft.event_date || null,
            planting_date: draft.planting_date || null,
          },
        });
        setSaved(true);
      }}
    >
      {has("health") && (
        <fieldset>
          <legend>{t("Exposure preferences")}</legend>
          <p className="muted small">
            {t("Optional preferences for more cautious guidance.")}
          </p>
          <div className="check-options">
            {[
              ["air", "Air sensitivity"],
              ["pollen", "Pollen sensitivity"],
              ["sun", "Sun sensitivity"],
              ["heat", "Heat sensitivity"],
            ].map(([v, label]) => (
              <label key={v}>
                <input
                  type="checkbox"
                  checked={draft.sensitivities.includes(v)}
                  onChange={(e) =>
                    change(
                      "sensitivities",
                      e.target.checked
                        ? [...draft.sensitivities, v]
                        : draft.sensitivities.filter((x) => x !== v),
                    )
                  }
                />
                {t(label)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {has("fitness") && (
        <fieldset>
          <legend>{t("Outdoor activity")}</legend>
          <div className="plan-fields">
            <Field label={t("Exercise")}>
              {select("exercise", [
                ["running", "Running"],
                ["walking", "Walking"],
                ["cycling", "Cycling"],
              ])}
            </Field>
            <Field label={t("Intensity")}>
              {select("intensity", [
                ["light", "Light"],
                ["moderate", "Moderate"],
                ["vigorous", "Vigorous"],
              ])}
            </Field>
            <Field label={t("Duration (minutes)")}>
              {input("duration_minutes", "number", {
                min: 30,
                max: 240,
                step: 30,
                required: true,
              })}
            </Field>
            <Field label={t("Earliest start hour (0–23)")}>
              {input("preferred_start", "number", {
                min: 0,
                max: 23,
                required: true,
              })}
            </Field>
            <Field label={t("Latest finish hour (1–24)")}>
              {input("preferred_end", "number", {
                min: 1,
                max: 24,
                required: true,
              })}
            </Field>
          </div>
        </fieldset>
      )}
      {has("family") && (
        <fieldset>
          <legend>{t("School schedule")}</legend>
          <div className="plan-fields">
            <Field label={t("School drop-off")}>
              {input("school_dropoff", "time", { required: true })}
            </Field>
            <Field label={t("School pickup")}>
              {input("school_pickup", "time", { required: true })}
            </Field>
          </div>
          <p className="muted small">
            {t(
              "Local times for the selected city. Use the journey planner for separate home and school locations.",
            )}
          </p>
        </fieldset>
      )}
      {has("events") && (
        <fieldset>
          <legend>{t("Event details")}</legend>
          <div className="plan-fields">
            <Field label={t("Event date")}>{input("event_date", "date")}</Field>
            <Field label={t("Event start")}>
              {input("event_start", "time", { required: true })}
            </Field>
            <Field label={t("Event duration (hours)")}>
              {input("event_hours", "number", {
                min: 1,
                max: 12,
                required: true,
              })}
            </Field>
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={draft.event_shelter}
              onChange={(e) => change("event_shelter", e.target.checked)}
            />
            {t("I have an indoor backup")}
          </label>
          <p className="muted small">
            {t(
              "Leave the date blank for the weather reference day. Demo uses 15 June 2026.",
            )}
          </p>
        </fieldset>
      )}
      {has("agriculture") && (
        <fieldset>
          <legend>{t("Growing plans")}</legend>
          <div className="plan-fields">
            <Field label={t("Crop")}>
              {select("crop", [
                ["none", "Choose a crop"],
                ["tomato", "Tomato"],
                ["okra", "Okra / bhendi"],
                ["wheat_hd3226", "Wheat — HD 3226"],
              ])}
            </Field>
            <Field label={t("Growing region")}>
              {select("growing_region", [
                ["unspecified", "Choose your region"],
                ["south_india", "South India — tomato"],
                ["tamil_nadu", "Tamil Nadu — okra"],
                [
                  "north_western_plains",
                  "North Western Plains — wheat HD 3226",
                ],
              ])}
            </Field>
            <Field label={t("Planned planting date")}>
              {input("planting_date", "date")}
            </Field>
          </div>
          <p className="muted small">
            {t(
              "Three sourced crop/region calendars are included. Choose the matching region; these are not nationwide planting recommendations.",
            )}
          </p>
        </fieldset>
      )}
      <button className="btn primary" type="submit">
        {t("Apply my plans")}
      </button>
      {saved && <span role="status">{t("Preferences saved.")}</span>}
    </form>
  );
}
