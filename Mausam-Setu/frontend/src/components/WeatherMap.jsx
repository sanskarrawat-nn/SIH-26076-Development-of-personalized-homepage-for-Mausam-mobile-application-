import { t } from "../services/i18n";
import Locations from "./Locations";
import React, { useEffect, useState } from "react";
import { ExternalLink, Map, RefreshCw } from "lucide-react";
import { MAP_LAYERS, weatherMapUrl } from "../services/map";
import { formatMetric, time } from "../services/format";
import { Badge } from "./ui";

export default function WeatherMap({
  data,
  location,
  units,
  onLocationChange,
  saved,
  setSaved,
  onWhy,
  lowData = false,
}) {
  const [layer, setLayer] = useState("temp");
  const [loadState, setLoadState] = useState("loading");
  const [choosing, setChoosing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const url = weatherMapUrl(location, layer, units);
  useEffect(() => {
    setLoadState(online ? "loading" : "error");
    if (!online) return;
    const timeout = setTimeout(
      () => setLoadState((state) => (state === "loading" ? "error" : state)),
      20000,
    );
    return () => clearTimeout(timeout);
  }, [url, revision, online]);
  if (lowData)
    return (
      <p className="source-box">
        {t(
          "Low Data Mode: external weather maps are disabled. Turn off Low Data Mode in Privacy and notifications to restore automatic loading.",
        )}
      </p>
    );
  const metrics = data?.current_weather.metrics || {};
  return (
    <div className="map-explorer">
      <p className="map-notice">
        {t(
          "Windy receives selected coordinates and shows independent layers. Not simulated in Judge Mode. Coverage varies; PM2.5 is not US AQI.",
        )}
      </p>
      <div
        className="map-layers"
        role="group"
        aria-label={t("Weather map layers")}
      >
        {MAP_LAYERS.map((item) => (
          <button
            key={item.id}
            className="btn"
            aria-pressed={layer === item.id}
            onClick={() => setLayer(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      <div className="map-layout">
        <div>
          <div className="map-frame">
            {online && loadState !== "error" && (
              <iframe
                key={`${url}:${revision}`}
                title={t("Windy weather map")}
                src={url}
                referrerPolicy="no-referrer"
                onLoad={() => setLoadState("loaded")}
                onError={() => setLoadState("error")}
              />
            )}
            {loadState !== "loaded" && (
              <div className="map-placeholder map-overlay" role="status">
                <Map size={32} />
                <h3>
                  {t(
                    !online
                      ? "Map unavailable offline"
                      : loadState === "error"
                        ? "Interactive weather map could not be loaded."
                        : "Loading interactive weather map…",
                  )}
                </h3>
                {online && loadState === "loading" && (
                  <div className="skeleton map-loader" />
                )}
                {online && loadState === "error" && (
                  <button
                    className="btn"
                    onClick={() => setRevision((value) => value + 1)}
                  >
                    {t("Retry")}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="map-footer">
            <a href={url} target="_blank" rel="noreferrer">
              {t("Open map separately")}
              <ExternalLink size={14} />
            </a>
          </div>
          <p className="muted small">
            {t("Map:")}{" "}
            <a href="https://www.windy.com/" target="_blank" rel="noreferrer">
              {t("Windy")}
            </a>{" "}
            · ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              {t("OpenStreetMap contributors")}
            </a>
            {t(
              ". If a layer is blank or blocked, open the map separately or choose another layer. Panning the external map does not change the app's selected place.",
            )}
          </p>
        </div>
        <aside className="map-summary">
          <h3>{location.name}</h3>
          <button className="text-btn" onClick={() => setChoosing(!choosing)}>
            {t("Choose another place")}
          </button>
          {choosing && (
            <Locations
              current={location}
              saved={saved}
              setSaved={setSaved}
              onSelect={(place) => {
                onLocationChange(place);
                setChoosing(false);
              }}
            />
          )}
          {data ? (
            <>
              <Badge status={data.data_status.status} />
              <h4>{t("App forecast at selected place")}</h4>
              <dl>
                {[
                  "temperature",
                  "feels_like",
                  "humidity",
                  "wind",
                  "pressure",
                  "dew_point",
                ].map((key) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{formatMetric(metrics[key], units)}</dd>
                  </div>
                ))}
              </dl>
              <h4>
                {t("Weather advisories (")}
                {data.priority_alerts.length})
              </h4>
              {data.priority_alerts.map((alert) => (
                <p key={alert.id}>
                  <strong>
                    {t(alert.type)} · {t(alert.severity)}
                  </strong>
                  <br />
                  {t(alert.message)}
                </p>
              ))}
              <h4>{t("Personal impact")}</h4>
              {data.today_for_you.map((item) => (
                <article key={item.id}>
                  <strong>{t(item.title)}</strong>
                  <p>{t(item.message)}</p>
                  <button className="text-btn" onClick={() => onWhy(item)}>
                    {t("Why this for me?")}
                  </button>
                </article>
              ))}
              <p className="muted small">
                {data.data_status.source}
                <br />
                {t("Retrieved")}{" "}
                {time(data.data_status.retrieved_at, location.timezone)} ·{" "}
                {location.timezone}
              </p>
            </>
          ) : (
            <p>
              {t(
                "Weather summary unavailable. The external map can still be opened.",
              )}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
