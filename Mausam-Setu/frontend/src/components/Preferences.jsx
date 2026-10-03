import { t } from "../services/i18n";
import React from "react";
import Personas from "./Personas";
export default function Preferences({
  profile,
  setProfile,
  mode,
  setMode,
  judge,
  onSetup,
  onClear,
}) {
  return (
    <div className="settings">
      <h3>{t("Your interests")}</h3>
      <Personas
        large
        selected={profile.interests}
        onChange={(interests) => setProfile({ ...profile, interests })}
      />
      <fieldset>
        <legend>{t("Interest priority weights")}</legend>
        <p className="muted small">{t("Safety warnings always come first.")}</p>
        {profile.interests.map((interest) => (
          <label key={interest}>
            {t(interest)}
            <input
              aria-label={`${interest} priority`}
              type="range"
              min="0"
              max="2"
              step="0.25"
              value={profile.preference_weights?.[interest] ?? 1}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  preference_weights: {
                    ...profile.preference_weights,
                    [interest]: Number(event.target.value),
                  },
                })
              }
            />
            <output>{profile.preference_weights?.[interest] ?? 1}</output>
          </label>
        ))}
      </fieldset>
      <label>
        {t("Units")}
        <select
          aria-label={t("Units")}
          value={profile.units}
          onChange={(e) => setProfile({ ...profile, units: e.target.value })}
        >
          <option value="metric">{t("Celsius · km/h · mm")}</option>
          <option value="imperial">{t("Fahrenheit · mph · inches")}</option>
        </select>
      </label>
      <label>
        {t("Today’s activity")}
        <select
          value={profile.activity}
          onChange={(e) => setProfile({ ...profile, activity: e.target.value })}
        >
          {[
            "general",
            ...Object.keys({
              health: 1,
              fitness: 1,
              travel: 1,
              family: 1,
              agriculture: 1,
              commute: 1,
              marine: 1,
              events: 1,
            }),
          ].map((k) => (
            <option key={k} value={k}>
              {t(k.charAt(0).toUpperCase() + k.slice(1))}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Weather mode")}
        <select
          aria-label={t("Weather mode")}
          value={mode}
          disabled={judge}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="live">{t("Connect to weather providers")}</option>
          <option value="live_only">
            {t("Providers only · no simulated fallback")}
          </option>
          <option value="demo">{t("Demonstration data")}</option>
        </select>
      </label>
      <label className="toggle-row">
        <span>
          {t("In-app advisory reminders")}
          <small>{t("While the app is open; one-hour cooldown.")}</small>
        </span>
        <input
          type="checkbox"
          checked={profile.notifications}
          onChange={(e) =>
            setProfile({ ...profile, notifications: e.target.checked })
          }
        />
      </label>
      <button className="btn" onClick={onSetup}>
        {t("Run welcome setup again")}
      </button>
      <button className="text-btn danger" onClick={onClear}>
        {t("Clear my device data")}
      </button>
      <p className="muted small">
        {t(
          "Preferences and saved places stay on this device. No account or background location tracking.",
        )}
      </p>
    </div>
  );
}
