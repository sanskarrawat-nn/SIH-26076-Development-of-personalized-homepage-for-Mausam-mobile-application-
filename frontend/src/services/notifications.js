import { t } from "./i18n.js";
import { readLocal, saveLocal } from "./storage.js";
export const CATEGORIES = [
  "official",
  "school",
  "fitness",
  "commute",
  "event",
  "journey",
  "student",
];
const LEVELS = { info: 0, caution: 1, warning: 2, severe: 3 };
export function eligible(candidate, preferences, sent, now = Date.now()) {
  if (!preferences.enabled || !["live", "estimated"].includes(candidate.status))
    return false;
  if (
    !Array.isArray(preferences.categories) ||
    !preferences.categories.includes(candidate.category)
  )
    return false;
  if ((LEVELS[candidate.severity] ?? 0) < (LEVELS[preferences.severity] ?? 1))
    return false;
  if (
    !Number.isFinite(Date.parse(candidate.expires_at)) ||
    Date.parse(candidate.expires_at) <= now
  )
    return false;
  const key = `${candidate.category}:${candidate.id}`;
  const cooldown = Math.max(15, preferences.cooldown || 60) * 60000;
  return !sent[key] || now - sent[key] >= cooldown;
}
export async function notify(candidate) {
  if (!("Notification" in globalThis) || Notification.permission !== "granted")
    return false;
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration) return false;
  await registration.showNotification(candidate.title || "Mausam Setu", {
    body: t(candidate.message),
    tag: `mausam-${candidate.category}-${candidate.id}`,
    data: { url: "/", expires_at: candidate.expires_at },
  });
  return true;
}

// Serialize all foreground modules so concurrent updates cannot send duplicates.
let pending = Promise.resolve();
export function dispatchNotifications(candidates) {
  pending = pending
    .catch(() => {})
    .then(async () => {
      const preferences = normalizeNotificationPreferences(
        readLocal("mausam.notification-prefs", { enabled: false }),
      );
      const sent = readLocal("mausam.notification-sent", {});
      if (Date.now() - (sent.__batch || 0) < 15 * 60000) return;
      let count = 0;
      const order = { severe: 3, warning: 2, caution: 1, info: 0 };
      for (const candidate of [...candidates].sort(
        (a, b) =>
          (b.category === "official") - (a.category === "official") ||
          (order[b.severity] || 0) - (order[a.severity] || 0),
      )) {
        if (count >= 2) break;
        if (!eligible(candidate, preferences, sent)) continue;
        try {
          if (await notify(candidate)) {
            sent[`${candidate.category}:${candidate.id}`] = Date.now();
            count++;
          }
        } catch {}
      }
      if (count) sent.__batch = Date.now();
      for (const key of Object.keys(sent))
        if (Date.now() - sent[key] > 172800000) delete sent[key];
      saveLocal("mausam.notification-sent", sent);
    });
  return pending;
}

export function normalizeNotificationPreferences(value) {
  return {
    enabled: value?.enabled === true,
    categories: Array.isArray(value?.categories)
      ? value.categories.filter((v) => CATEGORIES.includes(v))
      : ["official", "commute", "student"],
    severity: ["info", "caution", "warning", "severe"].includes(value?.severity)
      ? value.severity
      : "caution",
    cooldown: [15, 30, 60, 180].includes(value?.cooldown) ? value.cooldown : 60,
  };
}
