import Community, { useCommunity, CommunityMap } from "./components/Community";
import SavedPlans, { ScheduleExtras } from "./components/Part2Planning";
import PrivacyControls from "./components/PrivacyControls";
import { learn, learnedWeights } from "./services/learning";

import Accessibility from "./components/Accessibility";
import {
  getLanguage,
  setLanguage,
  subscribeLanguage,
  t,
} from "./services/i18n";
import { answerQuestion, speak } from "./services/assistant";
import { useSyncExternalStore } from "react";
import DynamicHomepage, {
  DashboardSection,
} from "./components/DynamicHomepage";
import { RiskPanel, SafetyPanel, MetricPanel } from "./components/Safety";
import { aqiCategory, uvCategory } from "./services/environment";
import { MapPreview } from "./components/MapPreview";
import WeatherGlance from "./components/WeatherGlance";
import LiveClock from "./components/LiveClock";
import AlertInbox from "./components/AlertInbox";
import React, { useState, useEffect, lazy } from "react";
import {
  Sun,
  MapPin,
  ChevronDown,
  SlidersHorizontal,
  LayoutDashboard,
  Compass,
  FlaskConical,
  Bookmark,
  ArrowUpRight,
  ShieldCheck,
  Info,
  Wind,
  SunMedium,
  CloudRain,
  Settings,
  WifiOff,
  Bell,
  X,
} from "lucide-react";
import { useHome } from "./hooks/useHome";
import { readLocal, saveLocal, clearDeviceData } from "./services/storage";
import {
  DEFAULT_PROFILE,
  normalizeProfile,
  validLocation,
  validPlaces,
} from "./services/preferences";
import {
  formatMetric,
  date,
  time,
  locationKey,
  LABELS,
} from "./services/format";
import InterestStrip from "./components/InterestStrip";
import Locations, { PLACES } from "./components/Locations";
import Onboarding from "./components/Onboarding";
import Forecast from "./components/Forecast";
import Insights, { Explanation } from "./components/Insights";
import JudgeMode from "./components/JudgeMode";
import WeatherOverview from "./components/WeatherOverview";
import Preferences from "./components/Preferences";
import Planning from "./components/Planning";
import { Modal, Badge, Empty } from "./components/ui";

const WeatherMap = lazy(() => import("./components/WeatherMap"));
const AskMausam = lazy(() => import("./components/AskMausam"));
const initialProfile = DEFAULT_PROFILE;
export default function App() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  const [accessibility, setAccessibility] = useState(() => {
    const stored = readLocal("mausam.accessibility", {});
    return stored && typeof stored === "object" ? stored : {};
  });
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    saveLocal("mausam.accessibility", accessibility);
    for (const key of [
      "screenReader",
      "largeText",
      "highContrast",
      "reducedMotion",
      "strongWarnings",
    ])
      document.documentElement.classList.toggle(
        key,
        accessibility[key] === true,
      );
  }, [accessibility]);
  const [profile, setProfile] = useState(() =>
    normalizeProfile(readLocal("mausam.profile", initialProfile)),
  );
  const [location, setLocation] = useState(() => {
    const stored = readLocal("mausam.location", PLACES[0]);
    return validLocation(stored) ? stored : PLACES[0];
  });
  const [saved, setSaved] = useState(() =>
    validPlaces(readLocal("mausam.saved", [])),
  );
  const [recent, setRecent] = useState(() =>
    validPlaces(readLocal("mausam.recent", []), 4),
  );
  const [onboarding, setOnboarding] = useState(
    () => !readLocal("mausam.onboarded", false),
  );
  const [modal, setModal] = useState(null),
    [why, setWhy] = useState(null),
    [judge, setJudge] = useState(false),
    [scenario, setScenario] = useState("heat");
  const [mode, setMode] = useState(() => {
      const savedMode = readLocal("mausam.mode", "live");
      return ["live", "live_only", "demo"].includes(savedMode)
        ? savedMode
        : "live";
    }),
    [toast, setToast] = useState("");
  const [lowData, setLowData] = useState(
    () => readLocal("mausam.low-data", false) === true,
  );
  const [learning, setLearning] = useState(() =>
    readLocal("mausam.learning", { enabled: true, scores: {}, hours: {} }),
  );
  useEffect(() => {
    saveLocal("mausam.learning", learning);
  }, [learning]);
  useEffect(() => {
    saveLocal("mausam.low-data", lowData);
    document.documentElement.classList.toggle("low-data", lowData);
  }, [lowData]);
  const adapted = learnedWeights(learning);
  const effectiveProfile = { ...profile, learned_weights: adapted };
  function feedback(item, signal) {
    setLearning((previous) => learn(previous, item.personas, signal));
    setToast(t("Feedback saved; safety warnings are unchanged."));
  }
  const { data, loading, error, retry } = useHome(
    location,
    effectiveProfile,
    judge ? "demo" : mode,
    scenario,
    lowData,
  );
  const community = useCommunity(
    location,
    judge || mode === "demo",
    scenario,
    data?.reference_time || "2026-06-15T06:00:00Z",
    lowData,
  );
  useEffect(() => {
    saveLocal("mausam.profile", profile);
  }, [profile]);
  useEffect(() => {
    saveLocal("mausam.location", location);
  }, [location]);
  useEffect(() => {
    saveLocal("mausam.saved", saved);
  }, [saved]);
  useEffect(() => {
    saveLocal("mausam.recent", recent);
  }, [recent]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!data || !profile.notifications) return;
    const sent = readLocal("mausam.alerts", {}),
      now = Date.now();
    let count = 0;
    for (const alert of data.priority_alerts) {
      const key = `${data.data_status.status}:${alert.id}`;
      if (!sent[key] || now - sent[key] > 3600000) {
        sent[key] = now;
        count++;
      }
    }
    for (const [key, value] of Object.entries(sent))
      if (now - value > 86400000) delete sent[key];
    saveLocal("mausam.alerts", sent);
    if (count)
      setToast(
        `${count} weather ${count === 1 ? "advisory" : "advisories"} to review. ${data.data_status.status === "simulated" ? "Demo conditions." : ""}`,
      );
  }, [data, profile.notifications]);
  function selectLocation(loc, closePicker = true) {
    setLocation(loc);
    setRecent((previous) =>
      [loc, ...previous.filter((x) => locationKey(x) !== locationKey(loc))]
        .filter((x) => !x.geolocated && x.name !== "My location")
        .slice(0, 4),
    );
    if (closePicker) setModal(null);
  }
  function finishOnboarding() {
    saveLocal("mausam.onboarded", true);
    setOnboarding(false);
  }
  function saveCurrent() {
    if (saved.some((x) => locationKey(x) === locationKey(location))) {
      setSaved(saved.filter((x) => locationKey(x) !== locationKey(location)));
      setToast("Place removed from saved locations.");
    } else {
      setSaved([...saved, location].slice(-12));
      setToast("Place saved on this device.");
    }
  }
  function reset() {
    setScenario("heat");
    setProfile({ ...initialProfile });
    setLocation(PLACES[0]);
  }
  useEffect(() => {
    saveLocal("mausam.mode", mode);
  }, [mode]);
  const current = data?.current_weather.metrics;
  const effectiveLocation = data?.location || location;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        {t("Skip to weather")}
      </a>
      <aside className="sidebar">
        <a className="brand" href="#main">
          <span className="brand-symbol">
            <Sun size={26} />
          </span>
          <span>
            {t("Mausam")}
            <span className="brand-personal">{t("SETU")}</span>
          </span>
        </a>
        <span className="nav-label">{t("YOUR EVERYDAY")}</span>
        <nav>
          <a className="nav-item active" href="#main">
            <LayoutDashboard size={19} />
            {t("My weather")}
          </a>
          <button className="nav-item" onClick={() => setModal("map")}>
            <Compass size={19} />
            {t("Weather map")}
          </button>
          <a className="nav-item" href="#forecast">
            <Compass size={19} />
            {t("Forecast")}
          </a>
          <button className="nav-item" onClick={() => setModal("locations")}>
            <Bookmark size={19} />
            {t("Saved places")}
            <span className="nav-count">{saved.length}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="personal-note">
            <span className="little-line" />
            <p>
              {t("Same weather.")}
              <br />
              <strong>{t("Your perspective.")}</strong>
            </p>
          </div>
          <button
            className={`nav-item ${judge ? "selected" : ""}`}
            aria-pressed={judge}
            onClick={() => setJudge(!judge)}
          >
            <FlaskConical size={19} />
            {t("Judge Mode")}
          </button>
          <button className="nav-item" onClick={() => setModal("settings")}>
            <Settings size={19} />
            {t("Preferences")}
          </button>
          <p className="sidebar-foot">
            {t("SIH26076 · Independent prototype")}
            <br />
            {t("Not an official IMD application")}
          </p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Sun size={22} />
            <strong>{t("Mausam Setu")}</strong>
          </div>
          <span className="topbar-title">
            {t("One Forecast. Different Users. Better Decisions.")}
          </span>
          <div className="topbar-actions">
            <select
              className="language-select"
              aria-label={t("Language")}
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="en">{t("English")}</option>
              <option value="hi">हिन्दी</option>
            </select>
            <button className="text-btn" onClick={() => setModal("ask")}>
              {t("Ask Mausam")}
            </button>
            <button
              className="text-btn"
              onClick={() => setModal("accessibility")}
            >
              {t("Accessibility")}
            </button>
            <AlertInbox data={data} onDetails={() => setModal("alerts")} />
            <button
              className={`judge-toggle ${judge ? "on" : ""}`}
              aria-pressed={judge}
              onClick={() => setJudge(!judge)}
            >
              <FlaskConical size={16} />
              <span>{t("Judge Mode")}</span>
            </button>
            <button
              className="icon-btn"
              aria-label={t("Preferences")}
              onClick={() => setModal("settings")}
            >
              <SlidersHorizontal size={20} />
            </button>
            <button
              className="avatar"
              aria-label={t("Personalize your profile")}
              onClick={() => setModal("settings")}
            >
              {t("You")}
            </button>
          </div>
        </header>
        <main
          id="main"
          className={data?.safety?.emergency ? "emergency-home" : ""}
        >
          <div className="page-intro">
            <div>
              <span className="eyebrow">
                {t("A LITTLE CLARITY FOR YOUR DAY")}
              </span>
              <h1>{t("Your day. Your weather.")}</h1>
              <p>
                {data
                  ? date(data.reference_time, data.location.timezone)
                  : t("Your personalized weather homepage")}
              </p>
            </div>
            <button
              className="location-picker"
              onClick={() => setModal("locations")}
            >
              <MapPin size={19} />
              <span>
                {location.name.split(",")[0]}
                <small>{location.country || "Selected location"}</small>
              </span>
              <ChevronDown size={17} />
            </button>
          </div>
          <LiveClock timezone={effectiveLocation.timezone} />
          {data && <WeatherGlance data={data} units={profile.units} />}
          {judge && (
            <JudgeMode
              scenario={scenario}
              setScenario={setScenario}
              profile={profile}
              setProfile={setProfile}
              onReset={reset}
            />
          )}
          <InterestStrip profile={profile} setProfile={setProfile} />
          {error && (
            <div className="connection-banner" role="alert">
              <WifiOff size={20} />
              <span>{error}</span>
              <button onClick={retry}>{t("Retry")}</button>
            </div>
          )}
          {loading ? (
            <div
              className="loading-area"
              role="status"
              aria-label={t("Loading personalized weather")}
            >
              <div className="skeleton hero-skeleton" />
              <div className="skeleton insight-skeleton" />
              <span>{t("Finding the weather that matters to you…")}</span>
            </div>
          ) : data ? (
            <>
              <div
                className={`data-ribbon ${data.data_status.status === "simulated" ? "demo" : ""}`}
              >
                <Badge status={data.data_status.status} />
                <span>
                  {data.data_status.offline
                    ? t("Offline — showing last available data.")
                    : data.data_status.status === "simulated"
                      ? t("Simulated weather · not current local conditions")
                      : `${data.data_status.freshness === "stale" ? "Stale · " : ""}Retrieved ${new Date(data.data_status.retrieved_at).toLocaleString("en-IN", { timeZone: data.location.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`}
                </span>
                <button
                  className="text-btn"
                  onClick={() => setModal("sources")}
                >
                  {t("Data details")}
                  <Info size={15} />
                </button>
              </div>
              <DynamicHomepage
                layout={data.homepage_layout}
                emergency={data.safety?.emergency}
              >
                {(data.safety?.emergency ||
                  data.safety?.official_warnings?.length > 0) && (
                  <DashboardSection widgetId="safety">
                    <SafetyPanel data={data} onMap={() => setModal("map")} />
                  </DashboardSection>
                )}
                <DashboardSection widgetId="risk">
                  <RiskPanel risk={data.weather_risk} />
                </DashboardSection>
                {profile.interests.includes("agriculture") && (
                  <DashboardSection widgetId="soil">
                    <MetricPanel
                      data={data}
                      kind="soil"
                      units={profile.units}
                    />
                  </DashboardSection>
                )}
                {profile.interests.includes("marine") && (
                  <DashboardSection widgetId="marine">
                    <MetricPanel
                      data={data}
                      kind="marine"
                      units={profile.units}
                    />
                  </DashboardSection>
                )}
                <DashboardSection widgetId="overview">
                  <WeatherOverview
                    data={data}
                    profile={profile}
                    location={location}
                    saved={saved}
                    onSave={saveCurrent}
                    onAlerts={() => setModal("alerts")}
                  />
                </DashboardSection>
                <DashboardSection widgetId="insights">
                  <Insights
                    data={data}
                    units={profile.units}
                    onFeedback={feedback}
                    onWhy={(item) => {
                      setWhy(item);
                      setLearning((previous) =>
                        learn(previous, item.personas, "opened"),
                      );
                    }}
                  />
                </DashboardSection>
                <DashboardSection widgetId="plans">
                  <ScheduleExtras
                    data={data}
                    profile={profile}
                    setProfile={setProfile}
                  />
                  <Planning
                    data={data}
                    profile={profile}
                    setProfile={setProfile}
                    location={effectiveLocation}
                    mode={judge ? "demo" : mode}
                    scenario={scenario}
                    saved={saved}
                    setSaved={setSaved}
                  />
                </DashboardSection>
                <DashboardSection widgetId="community">
                  <Community
                    data={data}
                    view={community}
                    location={effectiveLocation}
                    mode={judge ? "demo" : mode}
                    lowData={lowData}
                    onMap={() => setModal("communitymap")}
                  />
                </DashboardSection>
                <DashboardSection widgetId="saved_plans">
                  <SavedPlans
                    data={data}
                    location={effectiveLocation}
                    mode={judge ? "demo" : mode}
                    scenario={scenario}
                    lowData={lowData}
                  />
                </DashboardSection>
                <DashboardSection widgetId="controls">
                  <PrivacyControls
                    data={data}
                    learning={learning}
                    setLearning={setLearning}
                    lowData={lowData}
                    setLowData={setLowData}
                    onClearRecent={() => setRecent([])}
                    onClearAll={() => setModal("settings")}
                  />
                </DashboardSection>
                <DashboardSection widgetId="map">
                  <MapPreview
                    location={effectiveLocation}
                    onOpen={() => setModal("map")}
                  />
                </DashboardSection>
                <DashboardSection widgetId="forecast">
                  <Forecast data={data} units={profile.units} />
                </DashboardSection>
                <DashboardSection widgetId="environment">
                  <section className="panel environment">
                    <div className="section-head">
                      <div>
                        <span className="eyebrow">
                          {t("LOOK A LITTLE CLOSER")}
                        </span>
                        <h2>{t("Around you")}</h2>
                      </div>
                    </div>
                    {[
                      ["pressure", Compass],
                      ["dew_point", SunMedium],
                      ["wind_direction", Compass],
                      ["pm25", Wind],
                      ["pm10", Wind],
                      ["uv", SunMedium],
                      ["aqi", Wind],
                      ["rain_probability", CloudRain],
                      ["visibility", Compass],
                    ].map(([key, Icon]) => (
                      <div className="environment-row" key={key}>
                        <span className="metric-icon">
                          <Icon size={20} />
                        </span>
                        <span>
                          {t(LABELS[key])}
                          <small>
                            {key === "aqi"
                              ? `${aqiCategory(data.air_quality.aqi?.value)} · US AQI, not Indian NAQI`
                              : key === "uv"
                                ? `${uvCategory(current.uv?.value)} · forecast UV index`
                                : key === "visibility"
                                  ? t("Modelled visibility")
                                  : key === "rain_probability"
                                    ? t("Forecast probability")
                                    : t("Provider model estimate")}
                          </small>
                        </span>
                        <strong>
                          {formatMetric(
                            { ...current, ...data.air_quality }[key],
                            profile.units,
                          )}
                        </strong>
                      </div>
                    ))}
                    <button
                      className="text-btn environment-link"
                      onClick={() => setModal("sources")}
                    >
                      {t("Where does this come from?")}
                      <ArrowUpRight size={16} />
                    </button>
                  </section>
                </DashboardSection>
                {saved.length > 0 && (
                  <DashboardSection widgetId="places">
                    <section className="saved-strip">
                      <div>
                        <h2>{t("Your places")}</h2>
                        <p className="muted small">
                          {t(
                            "Switch destinations to get their forecast and advice.",
                          )}
                        </p>
                      </div>
                      <div className="saved-chips">
                        {saved.map((loc) => (
                          <button
                            key={locationKey(loc)}
                            onClick={() => selectLocation(loc)}
                          >
                            <MapPin size={16} />
                            {loc.name}
                            <ArrowUpRight size={15} />
                          </button>
                        ))}
                      </div>
                    </section>
                  </DashboardSection>
                )}
              </DynamicHomepage>
              <footer>
                <span>
                  <ShieldCheck size={16} />
                  {t("Every suggestion has a reason.")}
                </span>
                <button
                  className="text-btn"
                  onClick={() => setModal("sources")}
                >
                  {t("Sources & limitations")}
                </button>
                <span>
                  {t("Weather models via")}{" "}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Open-Meteo")}
                  </a>
                </span>
              </footer>
            </>
          ) : (
            <Empty title={t("Let’s reconnect your weather")}>
              {t("Check your connection and make sure the API is running.")}
              <button className="btn primary" onClick={retry}>
                {t("Try again")}
              </button>
            </Empty>
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label={t("Mobile navigation")}>
        <a href="#main">
          <LayoutDashboard size={20} />
          {t("My weather")}
        </a>
        <a href="#forecast">
          <Compass size={20} />
          {t("Forecast")}
        </a>
        <button onClick={() => setModal("map")}>
          <Compass size={20} />
          {t("Map")}
        </button>
        <button onClick={() => setModal("locations")}>
          <Bookmark size={20} />
          {t("Places")}
        </button>
      </nav>
      {onboarding && (
        <Onboarding
          profile={profile}
          setProfile={setProfile}
          location={location}
          setLocation={setLocation}
          saved={saved}
          setSaved={setSaved}
          onDone={finishOnboarding}
        />
      )}
      {modal === "ask" && (
        <Modal title={t("Ask Mausam")} onClose={() => setModal(null)}>
          <AskMausam
            data={data}
            profile={profile}
            voiceNavigation={accessibility.voiceNavigation}
            onNavigate={(action) => {
              if (action === "forecast") {
                setModal(null);
                setTimeout(
                  () => document.getElementById("forecast")?.scrollIntoView(),
                  0,
                );
              } else setModal(action);
            }}
          />
        </Modal>
      )}
      {modal === "accessibility" && (
        <Modal title={t("Accessibility")} onClose={() => setModal(null)}>
          <Accessibility
            settings={accessibility}
            setSettings={setAccessibility}
            onRead={() => {
              const answer = answerQuestion("weather summary", data, profile);
              if (!speak(typeof answer === "string" ? answer : answer.text))
                setToast(t("Speech output is unavailable in this browser."));
            }}
          />
        </Modal>
      )}
      {modal === "communitymap" && (
        <Modal
          title={t("Approximate report map")}
          onClose={() => setModal(null)}
        >
          <CommunityMap
            reports={community.reports}
            location={effectiveLocation}
          />
          <button className="btn" onClick={() => setModal("map")}>
            {t("Weather map explorer")}
          </button>
        </Modal>
      )}
      {modal === "map" && (
        <Modal
          title={t("Weather map explorer")}
          wide
          onClose={() => setModal(null)}
        >
          <button className="btn" onClick={() => setModal("communitymap")}>
            {t("Report map")}
          </button>
          <WeatherMap
            lowData={lowData}
            data={data}
            location={effectiveLocation}
            units={profile.units}
            onLocationChange={(place) => selectLocation(place, false)}
            saved={saved}
            setSaved={setSaved}
            onWhy={(item) => {
              setModal(null);
              setWhy(item);
            }}
          />
        </Modal>
      )}
      {modal === "locations" && (
        <Modal title={t("Your places")} onClose={() => setModal(null)}>
          <Locations
            current={location}
            onSelect={selectLocation}
            saved={saved}
            setSaved={setSaved}
            recent={recent}
          />
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title={t("Make it personal")} onClose={() => setModal(null)}>
          <Preferences
            profile={profile}
            setProfile={setProfile}
            mode={mode}
            setMode={setMode}
            judge={judge}
            onSetup={() => {
              setModal(null);
              setOnboarding(true);
            }}
            onClear={() => {
              const cleared = clearDeviceData();
              setProfile(initialProfile);
              setLowData(false);
              setLearning({ enabled: true, scores: {}, hours: {} });
              setAccessibility({});
              setLanguage("en");
              setMode("live");
              setLocation(PLACES[0]);
              setSaved([]);
              setRecent([]);
              setModal(null);
              setOnboarding(true);
              setToast(
                cleared
                  ? "Device preferences and saved weather cleared."
                  : "Session reset. Browser storage could not be cleared.",
              );
            }}
          />
        </Modal>
      )}
      {why && data && (
        <Modal title={t("Why this for you?")} onClose={() => setWhy(null)}>
          <Explanation item={why} data={data} judge={judge} />
        </Modal>
      )}
      {modal === "alerts" && data && (
        <Modal title={t("Weather advisories")} onClose={() => setModal(null)}>
          <p className="muted">
            {t(
              "App-generated weather screening. Official warnings are not connected; absence of an advisory does not establish safety.",
            )}
          </p>
          {data.priority_alerts.length ? (
            data.priority_alerts.map((a) => (
              <div className="alert-detail" key={a.id}>
                <Badge status={a.status} />
                <h3>
                  {a.severity.toUpperCase()} · {a.type}
                </h3>
                <p>{t(a.message)}</p>
                <p className="muted small">{a.reason}</p>
                <small>
                  {a.source}
                  {t("· Expires")} {time(a.end_time, data.location.timezone)}
                </small>
              </div>
            ))
          ) : (
            <Empty title={t("No active app advisories")}>
              {t("No configured thresholds triggered by available inputs.")}
            </Empty>
          )}
        </Modal>
      )}
      {modal === "sources" && data && (
        <Modal
          title={t("Your data, transparently")}
          onClose={() => setModal(null)}
          wide
        >
          <Badge status={data.data_status.status} />
          <h3>{data.data_status.source}</h3>
          <p>
            {t("Retrieved:")}{" "}
            {new Date(data.data_status.retrieved_at).toLocaleString("en-IN", {
              timeZone: data.location.timezone,
            })}{" "}
            ({data.location.timezone})
          </p>
          <ul className="notices">
            {data.data_status.notices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <div className="source-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Metric")}</th>
                  <th>{t("Value")}</th>
                  <th>{t("Status / source")}</th>
                  <th>{t("Valid at")}</th>
                  <th>{t("Retrieved / expires / quality")}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries({
                  ...data.current_weather.metrics,
                  ...data.air_quality,
                  ...data.marine,
                }).map(([key, m]) => (
                  <tr key={key}>
                    <td>{t(LABELS[key] || key)}</td>
                    <td>{formatMetric(m, profile.units)}</td>
                    <td>
                      {m.status}
                      <small>{m.source}</small>
                    </td>
                    <td>{time(m.valid_at, data.location.timezone)}</td>
                    <td>
                      {time(m.retrieved_at, data.location.timezone)} /{" "}
                      {time(m.expires_at, data.location.timezone)} /{" "}
                      {t(m.quality || "unavailable")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>{t("Provider integration status")}</h3>
          <ul>
            {data.provider_status?.map((provider) => (
              <li key={provider.provider}>
                <a href={provider.website} target="_blank" rel="noreferrer">
                  {provider.provider}
                </a>
                : {t(provider.message)}
              </li>
            ))}
          </ul>
          <div className="source-box">
            {t(
              "Pollen has limited regional coverage. Tide and traffic services require configuration. Road closures and official warnings:",
            )}{" "}
            <strong>{t("unavailable")}</strong>
            {t(
              ". Health information describes environmental conditions and does not diagnose illness.",
            )}
          </div>
          <p className="small muted">
            {t(
              "Weather: Open-Meteo and its national weather-model sources. Air: CAMS via Open-Meteo. Marine: Open-Meteo / DWD.",
            )}{" "}
            <a
              href="https://open-meteo.com/en/docs"
              target="_blank"
              rel="noreferrer"
            >
              {t("Provider documentation")}
            </a>
            .
          </p>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Bell size={18} />
          {toast}
          <button
            aria-label={t("Dismiss notification")}
            onClick={() => setToast("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
