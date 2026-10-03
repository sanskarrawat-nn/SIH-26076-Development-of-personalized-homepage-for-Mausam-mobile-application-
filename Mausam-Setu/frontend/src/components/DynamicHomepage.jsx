import React, { useState, useEffect } from "react";
import { t } from "../services/i18n";

export function DashboardSection({
  widgetId,
  children,
  definition,
  collapsible = false,
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dashboard-widget" data-widget={widgetId}>
      <details
        className={collapsible ? "secondary-weather" : "primary-weather"}
        open={!collapsible || open}
        onToggle={(event) => {
          if (collapsible) setOpen(event.currentTarget.open);
        }}
      >
        <summary hidden={!collapsible}>
          {t(definition?.title || "More weather tools")}
        </summary>
        {children}
      </details>
      {definition && (
        <details className="layout-reason">
          <summary>{t("Why this position?")}</summary>
          <p>
            {t("Layout priority")}: {definition.priority} ·{" "}
            {t("Not a weather-risk score")}
          </p>
          <ul>
            {definition.reason.map((reason) => (
              <li key={reason}>{t(reason)}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function DynamicHomepage({ layout = [], emergency, children }) {
  const [expanded, setExpanded] = useState(false);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 600px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const sections = React.Children.toArray(children).filter(
    React.isValidElement,
  );
  const definitions = new Map(layout.map((item) => [item.widget_id, item]));
  sections.sort(
    (a, b) =>
      (definitions.get(b.props.widgetId)?.priority || 0) -
      (definitions.get(a.props.widgetId)?.priority || 0),
  );
  const render = (section) =>
    React.cloneElement(section, {
      definition: definitions.get(section.props.widgetId),
    });
  const essential = sections.filter((section) =>
    ["safety", "risk"].includes(section.props.widgetId),
  );
  const ordinary = sections.filter(
    (section) => !["safety", "risk"].includes(section.props.widgetId),
  );
  if (!emergency) {
    const primaryIds = new Set([
      "safety",
      "risk",
      "forecast",
      "community",
      "map",
      ...ordinary.slice(0, 2).map((section) => section.props.widgetId),
    ]);
    return (
      <div className="dynamic-homepage">
        {sections.map((section) =>
          React.cloneElement(section, {
            definition: definitions.get(section.props.widgetId),
            collapsible: compact && !primaryIds.has(section.props.widgetId),
          }),
        )}
      </div>
    );
  }
  return (
    <div className="dynamic-homepage emergency-layout">
      {essential.map(render)}
      <button
        className="btn"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {t(expanded ? "Simplify emergency view" : "Show full dashboard")}
      </button>
      <div className="dynamic-homepage" hidden={!expanded}>
        {ordinary.map(render)}
      </div>
    </div>
  );
}
