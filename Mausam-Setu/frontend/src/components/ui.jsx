import { t } from "../services/i18n";
import React, { useEffect, useRef, useId, Suspense } from "react";
import {
  X,
  Sun,
  CloudRain,
  Cloud,
  CloudFog,
  CloudLightning,
  Snowflake,
} from "lucide-react";
import { weatherKind } from "../services/format";

export function IconWeather({ code, size = 28 }) {
  const icons = {
    clear: Sun,
    cloud: Cloud,
    rain: CloudRain,
    fog: CloudFog,
    snow: Snowflake,
    storm: CloudLightning,
    unknown: Cloud,
  };
  const Icon = icons[weatherKind(code)];
  return <Icon size={size} aria-hidden="true" strokeWidth={1.5} />;
}
export function Badge({ status }) {
  const labels = {
    live: "Live observations",
    estimated: "Estimated data",
    simulated: "Demo data",
    cached: "Cached data",
    unavailable: "Data unavailable",
    community_verified: "Community verified",
    community_unverified: "Community unverified",
  };
  return (
    <span className={`badge ${status}`}>{t(labels[status] || status)}</span>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-btn"
          aria-label={t("Close dialog")}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      <Suspense fallback={<p role="status">{t("Loading…")}</p>}>
        {children}
      </Suspense>
    </dialog>
  );
}
export function Empty({ title, children }) {
  return (
    <div className="empty">
      <Cloud size={36} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
