import { readLocal } from "../services/storage";
import { t } from "../services/i18n";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  MapPin,
  LocateFixed,
  Star,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { get } from "../services/api";
import { locationKey } from "../services/format";
export const PLACES = [
  {
    name: "Lucknow",
    latitude: 26.8467,
    longitude: 80.9462,
    country: "India",
    timezone: "Asia/Kolkata",
  },
  {
    name: "New Delhi",
    latitude: 28.6139,
    longitude: 77.209,
    country: "India",
    timezone: "Asia/Kolkata",
  },
  {
    name: "Mumbai",
    latitude: 19.076,
    longitude: 72.8777,
    country: "India",
    timezone: "Asia/Kolkata",
  },
  {
    name: "Panaji, Goa",
    latitude: 15.4909,
    longitude: 73.8278,
    country: "India",
    timezone: "Asia/Kolkata",
  },
  {
    name: "Guwahati",
    latitude: 26.1445,
    longitude: 91.7362,
    country: "India",
    timezone: "Asia/Kolkata",
  },
  {
    name: "Bengaluru",
    latitude: 12.9716,
    longitude: 77.5946,
    country: "India",
    timezone: "Asia/Kolkata",
  },
];
export default function Locations({
  current,
  onSelect,
  saved,
  setSaved,
  recent = [],
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [scope, setScope] = useState("cities");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function search(e) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      setResults(
        await get(
          "/api/locations/search?scope=" +
            scope +
            "&q=" +
            encodeURIComponent(query.trim()),
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    setError("");
    if (readLocal("mausam.allow-location", true) === false) {
      setError("GPS requests are disabled in Privacy and notifications.");
      return;
    }
    if (!navigator.geolocation) {
      setError("Location is not supported by this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const rounded = {
          name: "My location",
          geolocated: true,
          latitude: Math.round(coords.latitude * 100) / 100,
          longitude: Math.round(coords.longitude * 100) / 100,
          country: "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        try {
          const params = new URLSearchParams({
            latitude: rounded.latitude,
            longitude: rounded.longitude,
            timezone: rounded.timezone,
          });
          const named = await get("/api/locations/reverse?" + params);
          if (active.current) onSelect({ ...named, geolocated: true });
        } catch {
          if (active.current) onSelect(rounded);
        } finally {
          if (active.current) setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setError(
          "Location permission was denied or the location is unavailable. Search for a city instead.",
        );
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }
  function toggle(loc) {
    const key = locationKey(loc);
    setSaved(
      saved.some((x) => locationKey(x) === key)
        ? saved.filter((x) => locationKey(x) !== key)
        : [...saved, loc].slice(-12),
    );
  }
  const rows = (list) =>
    list.map((loc) => (
      <div className="location-row" key={locationKey(loc)}>
        <button onClick={() => onSelect(loc)}>
          <MapPin size={18} />
          <span>
            <strong>{loc.name}</strong>
            <small>
              {loc.country} · {loc.timezone}
            </small>
          </span>
          {locationKey(current) === locationKey(loc) && (
            <span className="tiny-label">{t("Selected")}</span>
          )}
        </button>
        <button
          className="icon-btn"
          aria-label={`${saved.some((x) => locationKey(x) === locationKey(loc)) ? "Unsave" : "Save"} ${loc.name}`}
          onClick={() => toggle(loc)}
        >
          <Star
            size={18}
            fill={
              saved.some((x) => locationKey(x) === locationKey(loc))
                ? "currentColor"
                : "none"
            }
          />
        </button>
      </div>
    ));
  return (
    <div className="locations">
      <label className="search-scope">
        {t("Search area")}
        <select
          aria-label={t("Location search type")}
          value={scope}
          onChange={(event) => {
            setScope(event.target.value);
            setResults(null);
          }}
        >
          <option value="cities">{t("Cities worldwide")}</option>
          <option value="india">
            {t("India: village, district or PIN code")}
          </option>
        </select>
      </label>
      <form onSubmit={search} className="search-form">
        <Search size={20} />
        <input
          aria-label={t("Search cities")}
          placeholder={
            scope === "india"
              ? "Village, district or PIN code"
              : "Search a city or destination"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          minLength={2}
        />
        <button className="btn primary" disabled={busy}>
          {t("Search")}
        </button>
      </form>
      <button className="text-btn locate" disabled={busy} onClick={locate}>
        <LocateFixed size={18} />
        {t("Use my current location")}
      </button>
      <p className="muted small">
        {t(
          "Location is rounded to a city-area coordinate. Saved and recent places stay on this device.",
        )}
      </p>
      <p className="muted small">
        {t("Detailed places and GPS names: Photon /")}{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          {t("© OpenStreetMap contributors")}
        </a>
        {t(". Search results depend on map coverage.")}
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {busy && <p role="status">{t("Finding locations…")}</p>}
      {results && (
        <>
          <h3>{t("Search results")}</h3>
          {results.length ? (
            rows(results)
          ) : (
            <p>{t("No matching cities. Try a nearby city.")}</p>
          )}
        </>
      )}
      {saved.length > 0 && (
        <>
          <h3>{t("Saved places")}</h3>
          {rows(saved)}
        </>
      )}
      {recent.length > 0 && (
        <>
          <h3>{t("Recent places")}</h3>
          {rows(recent)}
        </>
      )}
      <h3>{t("Quick locations")}</h3>
      {rows(PLACES)}
    </div>
  );
}
