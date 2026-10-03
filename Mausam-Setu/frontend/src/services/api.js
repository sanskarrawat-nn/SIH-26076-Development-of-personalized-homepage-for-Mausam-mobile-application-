const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export async function get(path, signal) {
  const response = await fetch(BASE + path, { signal });
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? "This service is temporarily unavailable."
        : `Request failed (${response.status}). Please retry.`,
    );
  return response.json();
}
export function homeQuery(location, profile, mode, scenario) {
  return (
    "/api/home/personalized?" +
    new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name,
      country: location.country || "",
      timezone: location.timezone,
      interests: profile.interests.join(","),
      activity: profile.activity || "general",
      planning: JSON.stringify(profile.planning || {}),
      preference_weights: JSON.stringify(profile.preference_weights || {}),
      learned_weights: JSON.stringify(profile.learned_weights || {}),
      mode,
      scenario,
    })
  );
}

export async function post(path, body, signal) {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(
      typeof problem.detail === "string"
        ? problem.detail
        : response.status === 422
          ? "Check the submitted fields, dates and locations."
          : "Service unavailable. Please retry.",
    );
  }
  return response.json();
}
