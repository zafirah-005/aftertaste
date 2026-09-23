import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { IconChartLine, IconChartBar } from "@tabler/icons-react";
import { api } from "../api/client";

const ACCENT = "#378add";
const ACCENT_STRONG = "#2a6da9";
const MUTED_LINE = "#9aa8b6";
const GRID = "#dfeaf3";
const TEXT_MUTED = "#6b7c8f";

function formatDay(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #dfeaf3",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(30,42,58,0.08)",
      }}
    >
      <div style={{ color: TEXT_MUTED, marginBottom: 4 }}>{formatDay(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #dfeaf3",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(30,42,58,0.08)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.name}</div>
      <div style={{ color: ACCENT }}>{d.total_cases} cases (30 days)</div>
    </div>
  );
}

export default function Charts({ villages }) {
  const [villageId, setVillageId] = useState("");
  const [history, setHistory] = useState([]);

  const activeId = villageId || (villages[0] && villages[0].id) || "";

  useEffect(() => {
    if (!activeId) return;
    api.getVillageHistory(activeId, 30).then(setHistory).catch(() => setHistory([]));
  }, [activeId]);

  const barData = useMemo(
    () => [...villages].sort((a, b) => b.total_cases - a.total_cases),
    [villages],
  );

  const activeVillage = villages.find((v) => v.id === Number(activeId));

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2>
            <IconChartLine size={18} /> Daily cases vs expected
          </h2>
          <select
            value={activeId}
            onChange={(e) => setVillageId(e.target.value)}
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 13,
              background: "white",
            }}
          >
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="section-sub">
          {activeVillage
            ? `${activeVillage.name} — solid line is reported cases, dashed line is the expected baseline`
            : ""}
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: TEXT_MUTED, marginBottom: 8 }}>
          <span>
            <span style={{ display: "inline-block", width: 14, height: 2, background: ACCENT, marginRight: 5, verticalAlign: "middle" }} />
            Actual cases
          </span>
          <span>
            <span style={{
              display: "inline-block", width: 14, height: 0, borderTop: `2px dashed ${MUTED_LINE}`,
              marginRight: 5, verticalAlign: "middle",
            }} />
            Expected (baseline avg)
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={history} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fontSize: 11, fill: TEXT_MUTED }}
              axisLine={{ stroke: GRID }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis tick={{ fontSize: 11, fill: TEXT_MUTED }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<LineTooltip />} />
            <Line
              type="monotone"
              dataKey="expected"
              name="Expected"
              stroke={MUTED_LINE}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cases"
              name="Actual"
              stroke={ACCENT}
              strokeWidth={2}
              dot={{ r: 3, fill: ACCENT, stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>
            <IconChartBar size={18} /> Total cases by village
          </h2>
        </div>
        <div className="section-sub">Last 30 days, highest first</div>
        <ResponsiveContainer width="100%" height={Math.max(240, barData.length * 26)}>
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            barCategoryGap={6}
          >
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" tick={{ fontSize: 11, fill: TEXT_MUTED }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: TEXT_MUTED }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(55,138,221,0.06)" }} />
            <Bar dataKey="total_cases" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              {barData.map((v, i) => (
                <Cell key={v.id} fill={i < 3 ? ACCENT_STRONG : ACCENT} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
