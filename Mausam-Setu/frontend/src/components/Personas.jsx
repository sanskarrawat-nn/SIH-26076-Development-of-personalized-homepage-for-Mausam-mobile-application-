import { t } from "../services/i18n";
import React from "react";
import {
  Heart,
  Footprints,
  Luggage,
  Sprout,
  Users,
  Car,
  Waves,
  CalendarDays,
  Check,
  GraduationCap,
  Mountain,
} from "lucide-react";
export const PERSONAS = {
  student: { label: "Student", icon: GraduationCap },
  hill: { label: "Hill / Highland", icon: Mountain },
  health: { label: "Health", icon: Heart },
  fitness: { label: "Fitness", icon: Footprints },
  travel: { label: "Travel", icon: Luggage },
  family: { label: "Family", icon: Users },
  agriculture: { label: "Agriculture", icon: Sprout },
  commute: { label: "Commute", icon: Car },
  marine: { label: "Marine", icon: Waves },
  events: { label: "Events", icon: CalendarDays },
};
export default function Personas({ selected, onChange, large = false }) {
  return (
    <div
      className={`personas ${large ? "large" : ""}`}
      aria-label={t("Your interests")}
    >
      {Object.entries(PERSONAS).map(([key, { label, icon: Icon }]) => (
        <button
          key={key}
          aria-pressed={selected.includes(key)}
          onClick={() =>
            onChange(
              selected.includes(key)
                ? selected.filter((x) => x !== key)
                : [...selected, key],
            )
          }
        >
          <Icon size={18} />
          {t(label)}
          {selected.includes(key) && <Check size={15} className="check" />}
        </button>
      ))}
    </div>
  );
}
