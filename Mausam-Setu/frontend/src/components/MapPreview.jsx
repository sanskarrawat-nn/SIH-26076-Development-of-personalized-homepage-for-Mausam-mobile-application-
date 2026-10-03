import React from "react";
import { Map } from "lucide-react";
import { t } from "../services/i18n";

export function MapPreview({ location, onOpen }) {
  return (
    <section className="panel map-preview" id="weather-map">
      <div className="section-head">
        <div>
          <span className="eyebrow">{t("A WIDER VIEW")}</span>
          <h2>{t("Weather map")}</h2>
        </div>
        <Map size={25} />
      </div>
      <p>
        {t(
          "Explore temperature, rainfall, wind, humidity, radar, satellite and PM2.5 around",
        )}{" "}
        {location.name}.
      </p>
      <button className="btn primary" onClick={onOpen}>
        {t("Explore weather map")}
      </button>
      <p className="muted small">
        {t(
          "Interactive map by Windy. Separate from the app's forecast and demonstration scenarios.",
        )}
      </p>
    </section>
  );
}
