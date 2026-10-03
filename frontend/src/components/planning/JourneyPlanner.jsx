import { dispatchNotifications } from "../../services/notifications";
import { t } from "../../services/i18n";
import React, { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import Locations, { PLACES } from "../Locations";
import { Modal, Badge } from "../ui";
import { Moment } from "./PlanSummary";
import Field from "./Field";
import { localDateTimeInput } from "../../services/dates";
import { usePlannerRequest } from "../../hooks/usePlannerRequest";

export default function JourneyPlanner({
  location,
  data,
  mode,
  scenario,
  saved,
  setSaved,
}) {
  const [origin, setOrigin] = useState(location),
    [destination, setDestination] = useState(PLACES[1]),
    [picker, setPicker] = useState(null);
  const [kind, setKind] = useState("commute"),
    [departure, setDeparture] = useState(
      localDateTimeInput(
        new Date(new Date(data.reference_time).getTime() + 3600000),
        location.timezone,
      ),
    ),
    [arrival, setArrival] = useState(
      localDateTimeInput(
        new Date(new Date(data.reference_time).getTime() + 10800000),
        destination.timezone,
      ),
    );
  const [departureCode, setDepartureCode] = useState(""),
    [arrivalCode, setArrivalCode] = useState("");
  const [transport, setTransport] = useState("car");
  const body = {
    transport,
    origin,
    destination,
    departure,
    arrival,
    kind,
    mode,
    scenario,
    departure_icao: departureCode,
    arrival_icao: arrivalCode,
  };
  const { result, busy, error, run } = usePlannerRequest(
    JSON.stringify([body, data.reference_time]),
  );
  useEffect(() => {
    if (!result) return;
    const hazards =
      result.route_weather?.samples?.filter(
        (r) => r.available && r.concerns?.length,
      ) || [];
    if (hazards.length)
      dispatchNotifications([
        {
          id: `journey:${origin.latitude}:${origin.longitude}:${destination.latitude}:${destination.longitude}:${departure}`,
          category: "journey",
          severity: hazards.some((r) => r.concerns.includes("Thunderstorms"))
            ? "warning"
            : "caution",
          status: result.route_weather.status,
          expires_at: new Date(
            Math.max(...hazards.map((r) => Date.parse(r.at))) + 3600000,
          ).toISOString(),
          message: `Route weather concerns: ${[...new Set(hazards.flatMap((r) => r.concerns))].join(", ")}. Review your journey.`,
        },
      ]);
  }, [result]);
  return (
    <details className="planner-details">
      <summary>{t("Journey & airport weather")}</summary>
      <form
        className="plan-form"
        onSubmit={(e) => {
          e.preventDefault();
          run("/api/planner/journey", body);
        }}
      >
        <Field label={t("Transport mode")}>
          <select
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
          >
            {["car", "bicycle", "pedestrian", "bus", "motorcycle"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label={t("Journey type")}>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="commute">{t("Commute")}</option>
            <option value="school">{t("School journey")}</option>
            <option value="flight">{t("Flight / airports")}</option>
          </select>
        </Field>
        <div className="plan-fields">
          {[
            ["origin", origin, setOrigin],
            ["destination", destination, setDestination],
          ].map(([key, loc, change]) => (
            <div key={key} className="place-plan">
              <strong>{key === "origin" ? t("From") : t("To")}</strong>
              <button
                type="button"
                className="btn"
                onClick={() => setPicker(key)}
              >
                <MapPin size={16} />
                {loc.name}
              </button>
              <small>{loc.timezone}</small>
              <details>
                <summary>{t("Exact coordinates")}</summary>
                <Field label={`${key} latitude`}>
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    required
                    value={loc.latitude}
                    onChange={(e) =>
                      change({
                        ...loc,
                        latitude: Number(e.target.value),
                        name: "Custom location",
                      })
                    }
                  />
                </Field>
                <Field label={`${key} longitude`}>
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    required
                    value={loc.longitude}
                    onChange={(e) =>
                      change({
                        ...loc,
                        longitude: Number(e.target.value),
                        name: "Custom location",
                      })
                    }
                  />
                </Field>
              </details>
            </div>
          ))}
        </div>
        <div className="plan-fields">
          <Field label={t("Departure (origin local time)")}>
            <input
              type="datetime-local"
              value={departure}
              required
              onChange={(e) => setDeparture(e.target.value)}
            />
          </Field>
          <Field label={t("Arrival (destination local time)")}>
            <input
              type="datetime-local"
              value={arrival}
              required
              onChange={(e) => setArrival(e.target.value)}
            />
          </Field>
        </div>
        {kind === "flight" && (
          <div className="plan-fields">
            <Field label={t("Departure ICAO code (optional)")}>
              <input
                placeholder={t("e.g. VILK")}
                maxLength={4}
                pattern="[A-Z]{4}"
                value={departureCode}
                onChange={(e) => setDepartureCode(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label={t("Arrival ICAO code (optional)")}>
              <input
                placeholder={t("e.g. VIDP")}
                maxLength={4}
                pattern="[A-Z]{4}"
                value={arrivalCode}
                onChange={(e) => setArrivalCode(e.target.value.toUpperCase())}
              />
            </Field>
          </div>
        )}
        <p className="muted small">
          {t(
            "Provider routes support five intermediate weather samples. Without route access, only endpoints are screened. Airport coordinates must match the ICAO code. Demo plans use 15–21 June 2026.",
          )}
        </p>
        <button className="btn primary" disabled={busy}>
          {busy ? t("Checking your journey…") : t("Check journey")}
        </button>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </form>
      {result && (
        <div className="journey-results">
          <div className="plan-grid">
            {result.endpoints.map((r) => (
              <article className="plan-result" key={r.label}>
                <Badge status={r.status} />
                <h3>
                  {r.label} · {r.location}
                </h3>
                <p className="small">
                  <Moment value={r.at} tz={r.timezone} />
                </p>
                <p>{r.message}</p>
                {r.rain_probability != null && (
                  <p>
                    {t("Peak rain chance:")}
                    {r.rain_probability}%
                  </p>
                )}
              </article>
            ))}
          </div>
          {result.traffic && (
            <article className="plan-result">
              <Badge status={result.traffic.status} />
              <h3>{t("Journey traffic")}</h3>
              {result.traffic.minutes != null && (
                <p>
                  <strong>
                    {result.traffic.minutes}
                    {t("min")}
                  </strong>{" "}
                  · {result.traffic.km}
                  {t("km ·")}
                  {result.traffic.delay_minutes}
                  {t("min traffic delay")}
                </p>
              )}
              <p>{result.traffic.message}</p>
            </article>
          )}
          {result.route_weather && (
            <article className="plan-result">
              <h3>{t("Route weather")}</h3>
              <Badge status={result.route_weather.status} />
              <p>{result.route_weather.message}</p>
              <div className="part2-grid">
                {result.route_weather.samples.map((r, i) => (
                  <div className="part2-card" key={i}>
                    <strong>
                      {t("Sample")} {i + 1}
                    </strong>
                    <p>
                      {r.latitude.toFixed(2)}, {r.longitude.toFixed(2)} ·{" "}
                      <Moment value={r.at} tz={origin.timezone} />
                    </p>
                    <p>{r.message}</p>
                    <small>
                      {r.source} · {r.status}
                    </small>
                  </div>
                ))}
              </div>
            </article>
          )}
          {result.comparison && (
            <article className="plan-result">
              <h3>{t("Destination comparison")}</h3>
              <p>{result.comparison.message}</p>
              <p>
                {t("Packing checklist")}: {result.comparison.packing.join(", ")}
              </p>
            </article>
          )}
          {result.airports?.map((r) => (
            <article key={r.label} className="plan-result">
              <Badge status={r.status} />
              <h3>{r.label}</h3>
              <p>{r.message}</p>
              {r.reports?.map((report) => (
                <details key={report.type}>
                  <summary>
                    {report.type}
                    {t("bulletin")}
                  </summary>
                  <p className="small">{report.valid}</p>
                  <pre className="aviation-report">{report.text}</pre>
                </details>
              ))}
            </article>
          ))}
          <p className="muted small">
            {result.scope}
            {t("Official warnings are not connected.")}{" "}
            <a
              href={result.official_warning_url}
              target="_blank"
              rel="noreferrer"
            >
              {t("Check IMD warnings")}
            </a>
            {kind === "flight" &&
              " · Flight delays and cancellations are not provided."}
          </p>
        </div>
      )}
      {picker && (
        <Modal title={`Choose ${picker}`} onClose={() => setPicker(null)}>
          <Locations
            current={picker === "origin" ? origin : destination}
            saved={saved}
            setSaved={setSaved}
            onSelect={(loc) => {
              (picker === "origin" ? setOrigin : setDestination)(loc);
              setPicker(null);
            }}
          />
        </Modal>
      )}
    </details>
  );
}
