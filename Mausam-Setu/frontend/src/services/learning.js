// Device-only, bounded preference learning. Never filters safety or alert arrays.
export function learn(state, personas, signal, hour = new Date().getHours()) {
  if (state?.enabled === false) return state;
  const delta =
    { opened: 0.05, useful: 0.2, not_useful: -0.2, dismissed: -0.1 }[signal] ||
    0;
  const scores = { ...(state?.scores || {}) };
  const hours = { ...(state?.hours || {}) };
  for (const persona of personas) {
    scores[persona] = Math.max(
      -1,
      Math.min(1, (Number(scores[persona]) || 0) + delta),
    );
    const key = `${persona}:${Math.floor(hour / 3)}`;
    hours[key] = Math.max(
      -0.5,
      Math.min(0.5, (Number(hours[key]) || 0) + delta / 2),
    );
  }
  return { enabled: true, scores, hours };
}
export function learnedWeights(state, hour = new Date().getHours()) {
  if (state?.enabled === false) return {};
  return Object.fromEntries(
    Object.entries(state?.scores || {})
      .filter(
        ([p, score]) =>
          [
            "fitness",
            "health",
            "agriculture",
            "travel",
            "family",
            "commute",
            "marine",
            "events",
            "student",
            "hill",
          ].includes(p) && Number.isFinite(score),
      )
      .map(([p, score]) => [
        p,
        Math.max(
          0,
          Math.min(
            2,
            1 +
              score +
              (Number(state.hours?.[`${p}:${Math.floor(hour / 3)}`]) || 0),
          ),
        ),
      ]),
  );
}
