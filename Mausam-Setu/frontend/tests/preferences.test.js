import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProfile, validPlaces } from "../src/services/preferences.js";
import { condition, formatMetric } from "../src/services/format.js";

test("corrupted preferences are repaired before API requests", () => {
  const profile = normalizeProfile({
    interests: ["fitness", "bogus", "fitness"],
    planning: {
      duration_minutes: -1,
      school_pickup: "25:00",
      event_date: "2026-02-30",
      preferred_start: 22,
      preferred_end: 4,
    },
  });
  assert.deepEqual(profile.interests, ["fitness"]);
  assert.equal(profile.planning.duration_minutes, 60);
  assert.equal(profile.planning.school_pickup, "14:00");
  assert.equal(profile.planning.event_date, null);
  assert.ok(profile.planning.preferred_end > profile.planning.preferred_start);
  assert.deepEqual(validPlaces([null, { name: "Invalid", latitude: 900 }]), []);
});

test("snow showers and missing weather values remain distinct", () => {
  assert.match(condition(85), /snow/i);
  assert.match(condition(86), /snow/i);
  assert.match(condition(95), /thunder/i);
  assert.match(condition(999), /unavailable/i);
  assert.equal(formatMetric({ value: NaN, unit: "°C" }), "Unavailable");
});
