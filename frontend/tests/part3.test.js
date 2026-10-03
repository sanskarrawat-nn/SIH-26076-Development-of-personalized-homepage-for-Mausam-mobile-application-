import test from "node:test";
import assert from "node:assert/strict";
import { answerQuestion } from "../src/services/assistant.js";
import { setLanguage } from "../src/services/i18n.js";
import { learnedWeights } from "../src/services/learning.js";

test("Hindi tomorrow-morning query uses the specific day window, not today", () => {
  const data = {
    location: { name: "Lucknow", timezone: "Asia/Kolkata" },
    data_status: { status: "simulated", freshness: "fresh" },
    reference_time: "2026-06-15T06:00:00+05:30",
    hourly: [],
    planning: {
      fitness: {
        available: true,
        start: "2026-06-15T06:00:00+05:30",
        end: "2026-06-15T07:00:00+05:30",
      },
      fitness_tomorrow_morning: {
        available: true,
        start: "2026-06-16T08:00:00+05:30",
        end: "2026-06-16T09:00:00+05:30",
      },
    },
  };
  setLanguage("hi");
  const answer = answerQuestion(
    "Kal morning running ke liye best time kya hai?",
    data,
    {},
  );
  assert.match(answer, /पूर्वानुमान/);
  assert.match(answer, /8:00|08:00/);
  assert.match(answer, /गारंटी नहीं/);
  setLanguage("en");
});
test("malformed learned records cannot inject unknown personas or nonnumeric weights", () => {
  assert.deepEqual(
    learnedWeights({ scores: { unknown: 1, fitness: "bad", student: NaN } }),
    {},
  );
  assert.ok(
    Number.isFinite(
      learnedWeights(
        { scores: { fitness: 0.2 }, hours: { "fitness:2": "oops" } },
        8,
      ).fitness,
    ),
  );
});
