import test from "node:test";
import assert from "node:assert/strict";
import { formatMetric, offlineCopy } from "../src/services/format.js";
test("unit conversion and unavailable inputs", () => {
  assert.equal(formatMetric({ value: 0, unit: "°C" }, "imperial"), "32°F");
  assert.equal(formatMetric({ value: 25.4, unit: "mm" }, "imperial"), "1 in");
  assert.equal(formatMetric(null), "Unavailable");
});
test("offline removes expired advice and marks cached metrics", () => {
  const home = {
    data_status: { status: "estimated" },
    current_weather: {
      metrics: { temperature: { status: "estimated", value: 25 } },
    },
    hourly: [],
    daily: [],
    air_quality: {},
    marine: {},
    personalized_sections: [{ expires_at: "2000-01-01" }],
    today_for_you: [],
    priority_alerts: [{ end_time: "2000-01-01" }],
  };
  const copy = offlineCopy(home);
  assert.equal(copy.data_status.status, "cached");
  assert.equal(copy.current_weather.metrics.temperature.status, "cached");
  assert.deepEqual(copy.personalized_sections, []);
  assert.deepEqual(copy.priority_alerts, []);
  assert.equal(home.data_status.status, "estimated");
});
test("offline expires future advisories when the source snapshot is too old", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const home = {
    data_status: {
      status: "estimated",
      retrieved_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    },
    current_weather: { metrics: {} },
    hourly: [],
    daily: [],
    air_quality: {},
    marine: {},
    planning: { event: { comfort: 95 } },
    personalized_sections: [{ expires_at: future }],
    today_for_you: [{ expires_at: future }],
    priority_alerts: [{ end_time: future }],
  };
  const copy = offlineCopy(home);
  assert.deepEqual(copy.planning, {});
  assert.deepEqual(copy.priority_alerts, []);
  assert.deepEqual(copy.personalized_sections, []);
});
