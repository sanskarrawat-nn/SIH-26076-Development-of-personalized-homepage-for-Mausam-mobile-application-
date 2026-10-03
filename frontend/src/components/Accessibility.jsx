import React from "react";
import { t } from "../services/i18n";
const OPTIONS = {
  screenReader: "Screen-reader optimized mode",
  largeText: "Large text",
  highContrast: "High contrast",
  reducedMotion: "Reduced motion",
  strongWarnings: "Strong visual warnings",
  voiceNavigation: "Voice navigation",
};
export default function Accessibility({ settings, setSettings, onRead }) {
  return (
    <section className="settings">
      <p>
        {t(
          "Choose each option independently. Warnings always include text and symbols.",
        )}
      </p>
      {Object.entries(OPTIONS).map(([key, label]) => (
        <label className="toggle-row" key={key}>
          <span>{t(label)}</span>
          <input
            type="checkbox"
            checked={!!settings[key]}
            onChange={(event) =>
              setSettings({ ...settings, [key]: event.target.checked })
            }
          />
        </label>
      ))}
      <button className="btn" onClick={onRead}>
        {t("Read weather aloud")}
      </button>
      <button
        className="text-btn"
        onClick={() => window.speechSynthesis?.cancel()}
      >
        {t("Stop speech")}
      </button>
    </section>
  );
}
