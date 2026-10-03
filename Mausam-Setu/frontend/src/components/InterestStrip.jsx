import React, { useEffect, useState } from "react";
import Personas, { PERSONAS } from "./Personas";
import { t } from "../services/i18n";
export default function InterestStrip({ profile, setProfile }) {
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 600px)").matches,
  );
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <section className="interest-strip">
      <details
        className="interest-disclosure"
        open={!compact || open}
        onToggle={(event) => {
          if (compact) setOpen(event.currentTarget.open);
        }}
      >
        <summary hidden={!compact}>
          <span>{t("Your interests")}</span>
          <strong>
            {profile.interests
              .map((p) => t(PERSONAS[p]?.label || p))
              .join(" + ") ||
              t("Choose an interest above to personalize your day.")}
          </strong>
        </summary>
        <div className="interest-heading">
          <strong>{t("What matters to you?")}</strong>
          <span>{t("Choose a few. Watch your day change.")}</span>
        </div>
        <Personas
          selected={profile.interests}
          onChange={(interests) => setProfile({ ...profile, interests })}
        />
      </details>
    </section>
  );
}
