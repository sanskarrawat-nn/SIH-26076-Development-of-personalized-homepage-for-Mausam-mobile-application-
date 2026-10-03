import React, { useEffect, useState } from "react";
import { readLocal, saveLocal } from "../services/storage";
import {
  CATEGORIES,
  dispatchNotifications,
  normalizeNotificationPreferences,
} from "../services/notifications";
import { t } from "../services/i18n";

export default function PrivacyControls({
  data,
  learning,
  setLearning,
  lowData,
  setLowData,
  onClearRecent,
  onClearAll,
}) {
  const [allowLocation, setAllowLocation] = useState(() =>
    readLocal("mausam.allow-location", true),
  );
  const [prefs, setPrefs] = useState(() =>
    normalizeNotificationPreferences(
      readLocal("mausam.notification-prefs", {
        enabled: false,
        categories: ["official", "commute", "student"],
        severity: "caution",
        cooldown: 60,
      }),
    ),
  );
  const [contacts, setContacts] = useState(() => {
    const stored = readLocal("mausam.contacts", []);
    return (Array.isArray(stored) ? stored : [])
      .filter(
        (c) =>
          c && typeof c.name === "string" && /^[+0-9 -]{5,20}$/.test(c.phone),
      )
      .slice(0, 5);
  });
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    saveLocal("mausam.notification-prefs", prefs);
  }, [prefs]);
  useEffect(() => {
    saveLocal("mausam.allow-location", allowLocation);
  }, [allowLocation]);
  useEffect(() => {
    saveLocal("mausam.contacts", contacts);
  }, [contacts]);
  useEffect(() => {
    let stopped = false;
    async function deliver() {
      const candidates = [
        ...data.priority_alerts.map((a) => ({
          id: a.id,
          category: ["heat", "uv", "aqi"].includes(a.type)
            ? "fitness"
            : "commute",
          severity: a.severity,
          status: a.status,
          expires_at: a.end_time,
          message: a.message,
        })),
        ...(data.safety?.official_warnings || []).map((a) => ({
          ...a,
          category: "official",
          expires_at: a.end_time,
        })),
        ...["student", "commute", "school"].flatMap((category) =>
          (data.planning?.[category] || [])
            .filter((w) => w.available && w.concerns?.length)
            .map((w) => ({
              id: `${category}:${w.start}:${data.location.latitude}:${data.location.longitude}`,
              category,
              severity: w.concerns.includes("Thunderstorms")
                ? "warning"
                : "caution",
              status: data.data_status.status,
              expires_at: w.end,
              message: `${w.label}: ${w.message}`,
            })),
        ),
      ];
      const event = data.planning?.event;
      if (event?.available && event.concerns?.length)
        candidates.push({
          id: `event:${event.start}`,
          category: "event",
          severity: event.concerns.includes("Thunderstorms")
            ? "warning"
            : "caution",
          status: data.data_status.status,
          expires_at: event.end,
          message: event.message,
        });
      if (
        data.planning?.fitness &&
        (data.current_weather.metrics.feels_like?.value ?? 0) >= 32
      )
        candidates.push({
          id: `fitness-heat:${data.location.latitude}:${data.location.longitude}:${data.reference_time.slice(0, 10)}`,
          category: "fitness",
          severity: "warning",
          status: data.data_status.status,
          expires_at: data.weather_risk.expires_at,
          message:
            "Heat is elevated. Recheck your workout window and consider reducing outdoor exertion.",
        });
      if (!stopped) await dispatchNotifications(candidates);
    }
    if (!data.data_status.offline) deliver();
    return () => {
      stopped = true;
    };
  }, [data, prefs]);
  return (
    <section className="panel part2-panel">
      <h2>{t("Privacy and notifications")}</h2>
      <details>
        <summary>{t("Device preferences")}</summary>
        <label className="toggle-row">
          {t("Low Data Mode")}
          <input
            type="checkbox"
            checked={lowData}
            onChange={(e) => setLowData(e.target.checked)}
          />
        </label>
        <p>
          {t(
            "Low Data Mode keeps safety text, reuses recent cache, reduces refreshes and disables heavy external maps and photo inputs.",
          )}
        </p>
        <label className="toggle-row">
          {t("Allow GPS requests")}
          <input
            type="checkbox"
            checked={allowLocation}
            onChange={(e) => setAllowLocation(e.target.checked)}
          />
        </label>
        <label className="toggle-row">
          {t("Learn from my feedback")}
          <input
            type="checkbox"
            checked={learning.enabled !== false}
            onChange={(e) =>
              setLearning({ ...learning, enabled: e.target.checked })
            }
          />
        </label>
        <button
          className="btn"
          onClick={() =>
            setLearning({
              enabled: learning.enabled !== false,
              scores: {},
              hours: {},
            })
          }
        >
          {t("Reset learned preferences")}
        </button>
        <p>
          {t(
            "Learning stays on this device and adjusts relevance only. Critical warnings cannot be suppressed.",
          )}
        </p>
        <button className="btn" onClick={onClearRecent}>
          {t("Clear recent places")}
        </button>
        <button className="btn" onClick={onClearAll}>
          {t("Clear my device data")}
        </button>
        <p>
          {t(
            "Deleting device data does not delete submitted community reports. Use each report receipt to delete it first. Browser site settings control OS notification and GPS permission.",
          )}
        </p>
      </details>
      <details>
        <summary>{t("Notification preferences")}</summary>
        <label className="toggle-row">
          {t("PWA notifications while open")}
          <input
            type="checkbox"
            checked={prefs.enabled}
            onChange={async (e) => {
              const enabled = e.target.checked;
              if (enabled) {
                if (!("Notification" in window)) {
                  setMessage(t("Notifications unavailable in this browser."));
                  return;
                }
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                  setMessage(t("Notification permission was not granted."));
                  return;
                }
              }
              setPrefs({ ...prefs, enabled });
            }}
          />
        </label>
        <div className="part2-grid">
          {CATEGORIES.map((category) => (
            <label key={category}>
              <input
                type="checkbox"
                checked={prefs.categories.includes(category)}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    categories: e.target.checked
                      ? [...prefs.categories, category]
                      : prefs.categories.filter((v) => v !== category),
                  })
                }
              />{" "}
              {t(category)}
            </label>
          ))}
        </div>
        <label>
          {t("Minimum severity")}
          <select
            value={prefs.severity}
            onChange={(e) => setPrefs({ ...prefs, severity: e.target.value })}
          >
            {["info", "caution", "warning", "severe"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Cooldown (minutes)")}
          <select
            value={prefs.cooldown}
            onChange={(e) => setPrefs({ ...prefs, cooldown: +e.target.value })}
          >
            {[15, 30, 60, 180].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <p role="status">{message}</p>
        <p className="muted">
          {t(
            "Background delivery is not configured. A Web Push sender, VAPID keys and scheduled jobs are required. Closing the app stops local checks. Demo notifications are disabled.",
          )}
        </p>
      </details>
      <details>
        <summary>{t("Emergency contacts")}</summary>
        <p>
          {t("Check official local warnings before outdoor plans.")}{" "}
          {t(
            "Pause exposed activities and follow local authority instructions.",
          )}
        </p>
        {data.configured_contacts?.map((c) => (
          <p key={c.phone}>
            {c.name} · {c.area}: <a href={`tel:${c.phone}`}>{c.phone}</a> ·{" "}
            <a href={c.source_url} target="_blank" rel="noreferrer">
              {t("Source")}
            </a>{" "}
            · {t("Checked")}: {new Date(c.checked_at).toLocaleDateString()}
          </p>
        ))}
        <p>
          <a href="tel:112">112</a> ·{" "}
          <a href="https://112.gov.in/" target="_blank" rel="noreferrer">
            {t("India emergency response")}
          </a>
        </p>
        <p>
          {t(
            "Personal contacts stay on this device. They are not verified emergency services.",
          )}
        </p>
        {contacts.map((c, i) => (
          <p key={i}>
            {c.name}: <a href={`tel:${c.phone}`}>{c.phone}</a>{" "}
            <button
              className="text-btn"
              onClick={() => setContacts(contacts.filter((_, n) => n !== i))}
            >
              {t("Remove")}
            </button>
          </p>
        ))}
        <form
          className="part2-form"
          onSubmit={(e) => {
            e.preventDefault();
            setContacts([...contacts, { name, phone }].slice(-5));
            setName("");
            setPhone("");
          }}
        >
          <label>
            {t("Contact name")}
            <input
              required
              maxLength="60"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {t("Phone")}
            <input
              type="tel"
              required
              pattern="[+0-9 -]{5,20}"
              maxLength="20"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button className="btn">{t("Save contact")}</button>
        </form>
      </details>
    </section>
  );
}
