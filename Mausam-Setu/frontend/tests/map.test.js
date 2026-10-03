import test from "node:test";
import assert from "node:assert/strict";
import { MAP_LAYERS, weatherMapUrl } from "../src/services/map.js";

test("all map layers retain coordinates and the correct product", () => {
  const location = { latitude: 26.84, longitude: 80.94 };
  assert.equal(MAP_LAYERS.length, 7);
  for (const layer of MAP_LAYERS) {
    const url = new URL(weatherMapUrl(location, layer.id));
    assert.equal(url.hostname, "embed.windy.com");
    assert.equal(url.searchParams.get("overlay"), layer.id);
    assert.equal(url.searchParams.get("product"), layer.product);
    assert.equal(url.searchParams.get("lat"), "26.84");
  }
  const imperial = new URL(weatherMapUrl(location, "temp", "imperial"));
  assert.equal(imperial.searchParams.get("metricTemp"), "°F");
  assert.equal(imperial.searchParams.get("metricWind"), "mph");
});

import { aqiCategory, uvCategory } from "../src/services/environment.js";
test("environment categories preserve missing values and boundaries", () => {
  assert.equal(aqiCategory(50), "Good");
  assert.equal(aqiCategory(100), "Moderate");
  assert.equal(aqiCategory(101), "Unhealthy for sensitive groups");
  assert.equal(aqiCategory(301), "Hazardous");
  assert.equal(aqiCategory(null), "Unavailable");
  assert.equal(uvCategory(0), "Low");
  assert.equal(uvCategory(3), "Moderate");
  assert.equal(uvCategory(8), "Very high");
  assert.equal(uvCategory(11), "Extreme");
  assert.equal(uvCategory(null), "Unavailable");
});
