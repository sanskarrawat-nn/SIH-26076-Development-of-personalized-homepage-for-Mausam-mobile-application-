export const MAP_LAYERS = [
  { id: "temp", label: "Temperature", product: "ecmwf" },
  { id: "rain", label: "Rainfall", product: "ecmwf" },
  { id: "wind", label: "Wind", product: "ecmwf" },
  { id: "rh", label: "Humidity", product: "ecmwf" },
  { id: "radar", label: "Radar", product: "radar" },
  { id: "satellite", label: "Satellite", product: "satellite" },
  { id: "pm2p5", label: "PM2.5", product: "cams" },
];

export function weatherMapUrl(location, layerId, units = "metric") {
  const layer = MAP_LAYERS.find((item) => item.id === layerId) || MAP_LAYERS[0];
  const query = new URLSearchParams({
    type: "map",
    location: "coordinates",
    zoom: "6",
    level: "surface",
    lat: String(location.latitude),
    lon: String(location.longitude),
    detailLat: String(location.latitude),
    detailLon: String(location.longitude),
    overlay: layer.id,
    product: layer.product,
    detail: "true",
    marker: "true",
    metricTemp: units === "imperial" ? "°F" : "°C",
    metricWind: units === "imperial" ? "mph" : "km/h",
    metricRain: units === "imperial" ? "in" : "mm",
  });
  return "https://embed.windy.com/embed.html?" + query;
}
