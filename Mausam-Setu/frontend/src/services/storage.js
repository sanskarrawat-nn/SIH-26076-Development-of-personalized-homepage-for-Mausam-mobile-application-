export function readLocal(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved == null) return fallback;
    if (Array.isArray(fallback)) return Array.isArray(saved) ? saved : fallback;
    if (fallback !== null && typeof fallback === "object") {
      return typeof saved === "object" && !Array.isArray(saved)
        ? saved
        : fallback;
    }
    if (fallback !== null && typeof saved !== typeof fallback) return fallback;
    return saved;
  } catch {
    return fallback;
  }
}

export function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearDeviceData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("mausam.")) localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}
