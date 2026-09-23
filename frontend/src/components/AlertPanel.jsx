import { useState } from "react";
import { IconAlertTriangle, IconCheck, IconX, IconSearch, IconMapPin, IconSparkles } from "@tabler/icons-react";
import { STATUS_COLORS } from "../statusColors";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "needs_checking", label: "Needs checking" },
  { value: "investigating", label: "Investigating" },
  { value: "confirmed", label: "Confirmed" },
  { value: "false_alarm", label: "False alarm" },
];

const STATUS_STYLE = {
  needs_checking: { bg: "#fdf3df", color: "#b3790f", label: "Needs checking" },
  investigating: { bg: "#e4f0fa", color: "#378add", label: "Investigating" },
  confirmed: { bg: "#e5f8ef", color: "#1c9963", label: "Confirmed" },
  false_alarm: { bg: "#eef2f5", color: "#6b7c8f", label: "False alarm" },
};

const ACTIONS = [
  { status: "confirmed", label: "Confirm", icon: IconCheck, color: "#1c9963", soft: "#e5f8ef" },
  { status: "investigating", label: "Investigating", icon: IconSearch, color: "#378add", soft: "#e4f0fa" },
  { status: "false_alarm", label: "False alarm", icon: IconX, color: "#6b7c8f", soft: "#eef2f5" },
];

export default function AlertPanel({ alerts, villages, onStatusChange }) {
  const [filter, setFilter] = useState("all");

  const visible = filter === "all" ? alerts : alerts.filter((a) => a.status === filter);
  const villageStatus = Object.fromEntries((villages || []).map((v) => [v.id, v.status]));

  return (
    <div className="card">
      <div className="card-header">
        <h2>
          <IconAlertTriangle size={18} /> Alerts
        </h2>
        <div style={{ textAlign: "right" }}>
          <span className="stat-label">Total</span>
          <span className="stat-value sm">{alerts.length}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className="btn"
            style={{
              padding: "5px 11px",
              fontSize: 12,
              background: filter === f.value ? "var(--accent-soft)" : "transparent",
              color: filter === f.value ? "var(--accent)" : "var(--text-muted)",
              border: "1px solid",
              borderColor: filter === f.value ? "var(--accent)" : "var(--border)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        className="scrollbar-thin"
        style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}
      >
        {visible.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>
            No alerts here right now.
          </div>
        )}

        {visible.map((alert) => {
          const style = STATUS_STYLE[alert.status];
          const severity = villageStatus[alert.village_id] || "alert";
          const stripColor = STATUS_COLORS[severity] || STATUS_COLORS.alert;

          return (
            <div
              key={alert.id}
              className="alert-card"
              style={{ borderLeftColor: stripColor }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 14 }}>
                    <IconMapPin size={14} style={{ color: "var(--text-muted)" }} />
                    {alert.village_name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                    {alert.alert_type === "cluster" ? "Cluster signal" : "Local spike"} · {alert.alert_date}
                  </div>
                </div>
                <span
                  className="badge"
                  style={{ background: style.bg, color: style.color, whiteSpace: "nowrap" }}
                >
                  {style.label}
                </span>
              </div>

              <p style={{ fontSize: 13, color: "var(--text)", margin: "10px 0" }}>{alert.reason}</p>

              <div style={{ marginBottom: 12 }}>
                <span className="stat-label">Confidence</span>
                <span className="stat-value sm">{alert.confidence}%</span>
              </div>

              {alert.ai_explanation && (
                <div className="ai-callout">
                  <IconSparkles size={14} />
                  <span>{alert.ai_explanation}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ACTIONS.map((a) => {
                  const active = alert.status === a.status;
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.status}
                      className="btn action-btn"
                      style={{
                        borderColor: active ? a.color : "var(--border)",
                        color: active ? a.color : "var(--text-muted)",
                        background: active ? a.soft : "white",
                      }}
                      onClick={() => onStatusChange(alert.id, a.status)}
                    >
                      <Icon size={13} /> {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
