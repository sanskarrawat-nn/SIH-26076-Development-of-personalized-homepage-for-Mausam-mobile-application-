import { t } from "./services/i18n";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { clearDeviceData } from "./services/storage";
import "./styles.css";
class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="empty">
        <h1>{t("Something interrupted your weather.")}</h1>
        <p>
          {t("Your stored preferences may be incompatible. Reset to reload.")}
        </p>
        <button
          onClick={() => {
            clearDeviceData();
            location.reload();
          }}
        >
          {t("Reset and reload")}
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <Boundary>
    <App />
  </Boundary>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
