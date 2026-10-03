import { t } from "../services/i18n";
import React, { useState } from "react";
import { ArrowRight, Sun, Check } from "lucide-react";
import { Modal } from "./ui";
import Personas from "./Personas";
import Locations from "./Locations";
export default function Onboarding({
  profile,
  setProfile,
  location,
  setLocation,
  saved,
  setSaved,
  onDone,
}) {
  const [step, setStep] = useState(0);
  const titles = [
    "One Forecast. Different Users. Better Decisions.",
    "What matters most to you?",
    "Where does your day begin?",
    "Choose your units",
    "Your alerts, your choice",
  ];
  return (
    <Modal title={t("Make Mausam yours")} onClose={onDone}>
      <div className="onboarding">
        <div className="step-label">
          {t("STEP")}
          {step + 1}
          {t("OF 5")}
        </div>
        <div className="steps">
          {titles.map((_, i) => (
            <span key={i} className={i <= step ? "done" : ""} />
          ))}
        </div>
        <h2>{t(titles[step])}</h2>
        {step === 0 && (
          <>
            <div className="welcome-icon">
              <Sun size={52} />
            </div>
            <p>
              {t("Less checking the weather.")}
              <br />
              {t("More knowing what to do.")}
            </p>
            <p className="muted">
              {t(
                "A homepage shaped around your interests, your location and the forecast—with a reason behind every suggestion.",
              )}
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <p className="muted">
              {t("Pick any combination. You can change these anytime.")}
            </p>
            <Personas
              large
              selected={profile.interests}
              onChange={(interests) => setProfile({ ...profile, interests })}
            />
          </>
        )}
        {step === 2 && (
          <>
            <p className="selection">
              {t("Selected:")}
              <strong>{location.name}</strong>
            </p>
            <Locations
              current={location}
              onSelect={setLocation}
              saved={saved}
              setSaved={setSaved}
            />
          </>
        )}
        {step === 3 && (
          <div className="option-grid">
            {[
              ["metric", "Celsius · km/h", "Metric"],
              ["imperial", "Fahrenheit · mph", "Imperial"],
            ].map(([value, label, title]) => (
              <button
                className={`option ${profile.units === value ? "selected" : ""}`}
                key={value}
                onClick={() => setProfile({ ...profile, units: value })}
              >
                <strong>{t(title)}</strong>
                <span>{t(label)}</span>
                {profile.units === value && <Check size={20} />}
              </button>
            ))}
          </div>
        )}
        {step === 4 && (
          <>
            <label className="toggle-row">
              <span>
                <strong>{t("Show advisory reminders")}</strong>
                <small>{t("In-app reminders while this app is open.")}</small>
              </span>
              <input
                type="checkbox"
                checked={profile.notifications}
                onChange={(e) =>
                  setProfile({ ...profile, notifications: e.target.checked })
                }
              />
            </label>
            <p className="muted">
              {t(
                "No background push messages are sent. App advisories are separate from official weather warnings.",
              )}
            </p>
          </>
        )}
        <div className="modal-actions">
          {step > 0 && (
            <button className="btn" onClick={() => setStep(step - 1)}>
              {t("Back")}
            </button>
          )}
          <button
            className="btn primary"
            onClick={() => (step === 4 ? onDone() : setStep(step + 1))}
          >
            {t(step === 4 ? "Show my weather" : "Continue")}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
