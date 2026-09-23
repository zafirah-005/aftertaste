import { useCallback, useEffect, useRef, useState } from "react";
import { IconDroplet, IconMap2, IconTopologyStar3 } from "@tabler/icons-react";
import "./App.css";
import { api } from "./api/client";
import MapView from "./components/MapView";
import ClusterNetworkView from "./components/ClusterNetworkView";
import ReportForm from "./components/ReportForm";
import AlertPanel from "./components/AlertPanel";
import SimulateButton from "./components/SimulateButton";
import Charts from "./components/Charts";

const POLL_MS = 4000;

const VIEWS = [
  { value: "map", label: "Map view", icon: IconMap2 },
  { value: "network", label: "Cluster network", icon: IconTopologyStar3 },
];

export default function App() {
  const [villages, setVillages] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeView, setActiveView] = useState("map");
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    const [v, a] = await Promise.all([api.getVillages(), api.getAlerts()]);
    setVillages(v);
    setAlerts(a);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [refresh]);

  async function handleAlertStatusChange(alertId, status) {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status } : a)));
    try {
      await api.updateAlertStatus(alertId, status);
    } catch {
      refresh();
    }
  }

  if (!loaded) {
    return (
      <div className="app-shell" style={{ paddingTop: 28 }}>
        <p style={{ color: "var(--text-muted)" }}>Loading Aftertaste…</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <div className="app-logo">
            <IconDroplet size={24} />
          </div>
          <div>
            <h1>Aftertaste</h1>
            <p>Early warning for food &amp; water contamination outbreaks</p>
          </div>
        </div>
        <SimulateButton villages={villages} onStep={refresh} />
      </header>

      <div className="app-grid">
        <div className="col-main">
          <div style={{ display: "flex", gap: 6 }}>
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const active = activeView === v.value;
              return (
                <button
                  key={v.value}
                  onClick={() => setActiveView(v.value)}
                  className="btn"
                  style={{
                    padding: "7px 13px",
                    fontSize: 13,
                    background: active ? "var(--accent-soft)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    border: "1px solid",
                    borderColor: active ? "var(--accent)" : "var(--border)",
                  }}
                >
                  <Icon size={15} /> {v.label}
                </button>
              );
            })}
          </div>

          {activeView === "map" ? (
            <MapView villages={villages} />
          ) : (
            <ClusterNetworkView villages={villages} alerts={alerts} onStep={refresh} />
          )}
          <Charts villages={villages} />
        </div>
        <div className="col-side">
          <ReportForm villages={villages} onSubmitted={refresh} />
          <AlertPanel alerts={alerts} villages={villages} onStatusChange={handleAlertStatusChange} />
        </div>
      </div>
    </div>
  );
}
