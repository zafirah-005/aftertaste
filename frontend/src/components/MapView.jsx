import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { IconMapPin } from "@tabler/icons-react";
import { api } from "../api/client";
import { STATUS_COLORS, STATUS_LABELS } from "../statusColors";

const PUNE_CENTER = [18.55, 73.95];

function radiusFor(village) {
  const cases = Math.max(village.today_cases, village.baseline_mean * 0.3);
  return Math.min(28, 7 + Math.sqrt(cases) * 2.6);
}

function dotClassName(status) {
  if (status === "alert") return "dot-alert";
  if (status === "rising") return "dot-rising";
  return "";
}

function VillagePopup({ village }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getVillageHistory(village.id, 7)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [village.id]);

  return (
    <div style={{ minWidth: 200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{village.name}</div>
        <span
          className="badge"
          style={{
            background: `${STATUS_COLORS[village.status]}1a`,
            color: STATUS_COLORS[village.status],
          }}
        >
          {STATUS_LABELS[village.status]}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>PIN {village.pincode}</div>

      <div style={{ display: "flex", gap: 18, marginBottom: 12 }}>
        <div>
          <span className="stat-label">Today</span>
          <span className="stat-value sm">{village.today_cases}</span>
        </div>
        <div>
          <span className="stat-label">Usual average</span>
          <span className="stat-value sm">{village.baseline_mean}</span>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Last 7 days</div>
      {!history && <div style={{ fontSize: 12 }}>Loading…</div>}
      {history && (
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40 }}>
          {history.map((h) => {
            const max = Math.max(1, ...history.map((x) => x.cases));
            const h2 = Math.max(2, (h.cases / max) * 36);
            return (
              <div
                key={h.date}
                title={`${h.date}: ${h.cases} cases`}
                style={{
                  width: 12,
                  height: h2,
                  background: "var(--accent)",
                  borderRadius: 2,
                  opacity: 0.85,
                  transition: "height 0.3s ease",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MapView({ villages }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>
          <IconMapPin size={18} /> Live village map
        </h2>
        <div className="legend-row">
          <span><span className="legend-dot" style={{ background: STATUS_COLORS.normal }} />Normal</span>
          <span><span className="legend-dot" style={{ background: STATUS_COLORS.rising }} />Rising</span>
          <span><span className="legend-dot" style={{ background: STATUS_COLORS.alert }} />Alert</span>
        </div>
      </div>
      <div style={{ borderRadius: 12, overflow: "hidden", height: 420, border: "1px solid var(--border)" }}>
        <MapContainer
          center={PUNE_CENTER}
          zoom={9}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {villages.map((v) => (
            <CircleMarker
              key={v.id}
              center={[v.lat, v.lng]}
              radius={radiusFor(v)}
              pathOptions={{
                color: STATUS_COLORS[v.status],
                fillColor: STATUS_COLORS[v.status],
                fillOpacity: 0.55,
                weight: 2,
                className: dotClassName(v.status),
              }}
            >
              <Popup>
                <VillagePopup village={v} />
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
