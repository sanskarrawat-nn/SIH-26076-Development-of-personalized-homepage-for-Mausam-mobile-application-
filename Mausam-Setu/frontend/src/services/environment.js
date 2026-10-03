// Categories describe the displayed model estimate, not a local monitoring-station reading.
export function aqiCategory(value) {
  if (!Number.isFinite(value) || value < 0) return "Unavailable";
  const index = Math.round(value);
  if (index <= 50) return "Good";
  if (index <= 100) return "Moderate";
  if (index <= 150) return "Unhealthy for sensitive groups";
  if (index <= 200) return "Unhealthy";
  if (index <= 300) return "Very unhealthy";
  return "Hazardous";
}

export function uvCategory(value) {
  if (!Number.isFinite(value) || value < 0) return "Unavailable";
  if (value < 3) return "Low";
  if (value < 6) return "Moderate";
  if (value < 8) return "High";
  if (value < 11) return "Very high";
  return "Extreme";
}
