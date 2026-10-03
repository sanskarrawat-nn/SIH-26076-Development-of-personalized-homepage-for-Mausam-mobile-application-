import test from "node:test";
import assert from "node:assert/strict";
import { answerQuestion } from "../src/services/assistant.js";
import { setLanguage, t } from "../src/services/i18n.js";
import { offlineCopy } from "../src/services/format.js";
const metric = { value: 30, unit: "%", status: "estimated" };
const data = {
  location: { name: "Lucknow", timezone: "Asia/Kolkata" },
  reference_time: "2026-06-15T00:30:00Z",
  data_status: { status: "estimated", freshness: "fresh" },
  hourly: [
    { time: "2026-06-16T03:30:00Z", metrics: { rain_probability: metric } },
  ],
  current_weather: { metrics: {} },
  weather_risk: { score: 20 },
};
test("assistant answers the requested day and refuses another city", () => {
  assert.match(
    answerQuestion("Kal baarish hogi?", data, { units: "metric" }),
    /30%/,
  );
  assert.match(
    answerQuestion("Delhi rain tomorrow", data, {}),
    /Select that location first/,
  );
  assert.match(
    answerQuestion("flight visibility", data, {}),
    /flight journey planner/,
  );
});
test("assistant never invents unavailable or incomplete weather", () => {
  assert.match(answerQuestion("weather", null, {}), /unavailable/);
  assert.match(answerQuestion("rain today", data, {}), /unavailable/);
  assert.match(
    answerQuestion(
      "rain tomorrow",
      { ...data, data_status: { status: "estimated", freshness: "expired" } },
      {},
    ),
    /unavailable/,
  );
});
test("voice navigation is a bounded action and unsupported intent gets help", () => {
  assert.equal(answerQuestion("open map", data, {}).action, "map");
  assert.match(answerQuestion("tell me stocks", data, {}), /Try:/);
});
test("Hindi catalog translates core controls and answer templates", () => {
  setLanguage("hi");
  assert.equal(t("Weather risk"), "मौसम जोखिम");
  assert.match(
    answerQuestion("कल बारिश होगी?", data, { units: "metric" }),
    /बारिश/,
  );
  assert.equal(t("Packing for Lucknow"), "Lucknow की यात्रा की तैयारी");
  setLanguage("en");
});
test("expired offline risk cannot retain emergency state", () => {
  const home = {
    ...data,
    daily: [],
    air_quality: {},
    marine: {},
    priority_alerts: [],
    personalized_sections: [],
    today_for_you: [],
    planning: {},
    data_status: { ...data.data_status, retrieved_at: "2020-01-01T00:00:00Z" },
    weather_risk: { score: 99, expires_at: "2020-01-01T01:00:00Z" },
    safety: { emergency: true },
    homepage_layout: [{ widget_id: "safety" }],
  };
  const copy = offlineCopy(home);
  assert.equal(copy.weather_risk.score, null);
  assert.equal(copy.safety.emergency, false);
  assert.equal(copy.homepage_layout.length, 0);
});
