import React, { useId } from "react";

export default function Field({ label, children }) {
  const id = useId();
  return (
    <div className="plan-field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, { id })}
    </div>
  );
}
