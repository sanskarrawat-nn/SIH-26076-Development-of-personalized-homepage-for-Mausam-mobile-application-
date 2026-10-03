export const DEFAULT_PLANNING = {
  student_activity: "sports",
  student_start: "09:00",
  student_end: "16:00",
  practice_time: "17:00",
  commute_departure: "08:00",
  commute_return: "18:00",
  commute_minutes: 30,
  transport_mode: "car",
  growth_stage: "unspecified",
  sensitivities: [],
  exercise: "running",
  intensity: "moderate",
  duration_minutes: 60,
  preferred_start: 5,
  preferred_end: 20,
  school_dropoff: "08:00",
  school_pickup: "14:00",
  event_date: "",
  event_start: "17:00",
  event_hours: 3,
  event_shelter: false,
  crop: "none",
  growing_region: "unspecified",
  planting_date: "",
};

export const DEFAULT_PROFILE = {
  interests: ["fitness", "health"],
  units: "metric",
  notifications: false,
  activity: "general",
};
const INTERESTS = [
  "health",
  "fitness",
  "travel",
  "family",
  "agriculture",
  "commute",
  "marine",
  "events",
  "student",
  "hill",
];

export function normalizeProfile(stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored))
    return { ...DEFAULT_PROFILE };
  const profile = { ...DEFAULT_PROFILE };
  if (Array.isArray(stored.interests))
    profile.interests = [
      ...new Set(stored.interests.filter((value) => INTERESTS.includes(value))),
    ];
  profile.units = stored.units === "imperial" ? "imperial" : "metric";
  profile.notifications = stored.notifications === true;
  profile.activity = INTERESTS.includes(stored.activity)
    ? stored.activity
    : "general";
  profile.preference_weights = Object.fromEntries(
    Object.entries(stored.preference_weights || {}).filter(
      ([key, value]) =>
        INTERESTS.includes(key) &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 2,
    ),
  );
  if (!stored.planning || typeof stored.planning !== "object") return profile;
  const saved = stored.planning;
  const planning = { ...DEFAULT_PLANNING };
  const choices = {
    student_activity: ["sports", "walking", "none"],
    transport_mode: ["car", "bicycle", "pedestrian", "bus", "motorcycle"],
    growth_stage: [
      "unspecified",
      "seedling",
      "vegetative",
      "flowering",
      "maturity",
    ],
    exercise: ["running", "walking", "cycling"],
    intensity: ["light", "moderate", "vigorous"],
    crop: ["none", "tomato", "okra", "wheat_hd3226"],
    growing_region: [
      "unspecified",
      "south_india",
      "tamil_nadu",
      "north_western_plains",
    ],
  };
  for (const [field, options] of Object.entries(choices)) {
    if (options.includes(saved[field])) planning[field] = saved[field];
  }
  for (const [field, minimum, maximum, step] of [
    ["duration_minutes", 30, 240, 30],
    ["commute_minutes", 5, 240, 1],
    ["preferred_start", 0, 23, 1],
    ["preferred_end", 1, 24, 1],
    ["event_hours", 1, 12, 1],
  ]) {
    const value = saved[field];
    if (
      Number.isInteger(value) &&
      value >= minimum &&
      value <= maximum &&
      value % step === 0
    )
      planning[field] = value;
  }
  if (planning.preferred_end <= planning.preferred_start) {
    planning.preferred_start = DEFAULT_PLANNING.preferred_start;
    planning.preferred_end = DEFAULT_PLANNING.preferred_end;
  }
  for (const field of [
    "school_dropoff",
    "school_pickup",
    "event_start",
    "student_start",
    "student_end",
    "practice_time",
    "commute_departure",
    "commute_return",
  ]) {
    if (
      typeof saved[field] === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(saved[field])
    )
      planning[field] = saved[field];
  }
  for (const field of ["event_date", "planting_date"]) {
    const value = saved[field];
    const parsed =
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(value + "T00:00:00Z")
        : null;
    planning[field] =
      parsed &&
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
        ? value
        : null;
  }
  planning.event_shelter = saved.event_shelter === true;
  planning.sensitivities = Array.isArray(saved.sensitivities)
    ? [
        ...new Set(
          saved.sensitivities.filter((value) =>
            ["air", "pollen", "sun", "heat"].includes(value),
          ),
        ),
      ]
    : [];
  profile.planning = planning;
  return profile;
}

export function validLocation(location) {
  if (
    !location ||
    typeof location.name !== "string" ||
    !location.name.trim() ||
    location.name.length > 120
  )
    return false;
  if (typeof location.country !== "string" || location.country.length > 80)
    return false;
  if (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90)
    return false;
  if (
    !Number.isFinite(location.longitude) ||
    Math.abs(location.longitude) > 180
  )
    return false;
  if (typeof location.timezone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: location.timezone });
    return true;
  } catch {
    return false;
  }
}

export function validPlaces(stored, limit = 12) {
  return Array.isArray(stored)
    ? stored.filter(validLocation).slice(0, limit)
    : [];
}
