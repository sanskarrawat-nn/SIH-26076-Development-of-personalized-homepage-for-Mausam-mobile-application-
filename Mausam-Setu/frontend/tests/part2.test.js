import test from "node:test";
import assert from "node:assert/strict";
import { learn, learnedWeights } from "../src/services/learning.js";
import { eligible } from "../src/services/notifications.js";
import { normalizeProfile } from "../src/services/preferences.js";

test("learning is bounded, time-aware and can be disabled or reset", () => {
  let state = { enabled: true, scores: {}, hours: {} };
  state = learn(state, ["student"], "useful", 8);
  assert.ok(
    learnedWeights(state, 8).student > learnedWeights(state, 16).student,
  );
  for (let i = 0; i < 100; i++) state = learn(state, ["student"], "useful", 8);
  assert.equal(learnedWeights(state, 8).student, 2);
  state = learn(state, ["student"], "not_useful", 8);
  assert.ok(state.scores.student < 1);
  const disabled = { ...state, enabled: false };
  assert.equal(learn(disabled, ["student"], "opened"), disabled);
  assert.deepEqual(learnedWeights(disabled), {});
  assert.deepEqual(learnedWeights({ scores: {}, hours: {} }), {});
});
test("notification consent, dedup, cooldown, category and demo checks", () => {
  const now = Date.now(),
    prefs = {
      enabled: true,
      categories: ["student"],
      severity: "caution",
      cooldown: 60,
    };
  const item = {
    id: "departure",
    category: "student",
    status: "estimated",
    severity: "warning",
    expires_at: new Date(now + 3600000).toISOString(),
  };
  assert.equal(eligible(item, prefs, {}, now), true);
  assert.equal(
    eligible(item, prefs, { "student:departure": now - 1000 }, now),
    false,
  );
  assert.equal(eligible(item, { ...prefs, enabled: false }, {}, now), false);
  assert.equal(
    eligible({ ...item, status: "simulated" }, prefs, {}, now),
    false,
  );
  assert.equal(eligible({ ...item, category: "event" }, prefs, {}, now), false);
  assert.equal(
    eligible({ ...item, expires_at: "invalid" }, prefs, {}, now),
    false,
  );
  assert.equal(eligible({ ...item, status: "cached" }, prefs, {}, now), false);
});
test("new personas and valid schedule preferences survive reload", () => {
  const result = normalizeProfile({
    interests: ["student", "hill"],
    planning: {
      student_start: "09:30",
      student_end: "25:00",
      commute_minutes: 45,
      transport_mode: "bicycle",
      growth_stage: "flowering",
    },
  });
  assert.deepEqual(result.interests, ["student", "hill"]);
  assert.equal(result.planning.student_start, "09:30");
  assert.equal(result.planning.student_end, "16:00");
  assert.equal(result.planning.commute_minutes, 45);
  assert.equal(result.planning.transport_mode, "bicycle");
});

test("foreground dispatch serializes batches and prioritizes official warnings", async () => {
  const { dispatchNotifications } =
    await import("../src/services/notifications.js");
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
  };
  memory.set(
    "mausam.notification-prefs",
    JSON.stringify({
      enabled: true,
      categories: ["official", "fitness"],
      severity: "caution",
      cooldown: 60,
    }),
  );
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const delivered = [];
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      serviceWorker: {
        getRegistration: async () => ({
          showNotification: async (title, options) =>
            delivered.push(options.tag),
        }),
      },
    },
  });
  globalThis.Notification = { permission: "granted" };
  const base = {
    status: "estimated",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    message: "Test fixture",
  };
  try {
    await Promise.all([
      dispatchNotifications([
        { ...base, id: "heat", category: "fitness", severity: "severe" },
        { ...base, id: "authority", category: "official", severity: "caution" },
      ]),
      dispatchNotifications([
        { ...base, id: "other", category: "fitness", severity: "warning" },
      ]),
    ]);
    assert.deepEqual(delivered, [
      "mausam-official-authority",
      "mausam-fitness-heat",
    ]);
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
    delete globalThis.Notification;
    delete globalThis.localStorage;
  }
});
