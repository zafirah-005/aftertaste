import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceCenter, forceX, forceY } from "d3-force";
import { IconTopologyStar3, IconX, IconSparkles } from "@tabler/icons-react";
import { api } from "../api/client";
import { STATUS_COLORS, STATUS_LABELS } from "../statusColors";
import SimulateButton from "./SimulateButton";

const HEIGHT = 440;
const CLICK_DRAG_THRESHOLD = 4; // px moved before a pointer-down counts as a drag, not a click
const FOCUS_SCALE = 1.7;
const FOCUS_HOLD_MS = 6500;
const RISK_COLOR = "#e5484d";

function radiusFor(village) {
  const cases = Math.max(village.today_cases, village.baseline_mean * 0.3);
  return Math.min(24, 8 + Math.sqrt(cases) * 2);
}

function dotClassName(status) {
  if (status === "alert") return "dot-alert";
  if (status === "rising") return "dot-rising";
  return "";
}

// Same grouping the backend cluster detector uses: villages that share the
// first 3 digits of their pincode are treated as a neighborhood.
function buildLinks(villages) {
  const groups = {};
  villages.forEach((v) => {
    const prefix = v.pincode.slice(0, 3);
    (groups[prefix] ||= []).push(v.id);
  });
  const links = [];
  Object.values(groups).forEach((ids) => {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        links.push({ source: ids[i], target: ids[j] });
      }
    }
  });
  return links;
}

function Sparkline({ history }) {
  if (!history) return <div style={{ fontSize: 12, color: "#7a8896" }}>Loading…</div>;
  const max = Math.max(1, ...history.map((h) => h.cases));
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 44 }}>
      {history.map((h) => (
        <div
          key={h.date}
          title={`${h.date}: ${h.cases} cases`}
          style={{
            width: 10,
            height: Math.max(2, (h.cases / max) * 40),
            background: "#378add",
            borderRadius: 2,
            opacity: 0.9,
            transition: "height 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

export default function ClusterNetworkView({ villages, alerts, onStep }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const dragState = useRef(null);
  const prevStatusRef = useRef({});
  const rippleKeyRef = useRef(0);
  const focusTimeoutRef = useRef(null);

  const [width, setWidth] = useState(760);
  const [, bumpTick] = useState(0);
  const forceRerender = () => bumpTick((n) => n + 1);

  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState(null);
  const [ripples, setRipples] = useState([]);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });

  // Track container width so the graph fills the card without distorting circles.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build (once) or update-in-place (on every poll) the simulation, so
  // dragged positions never get reset by fresh data arriving.
  useEffect(() => {
    if (!villages.length) return;

    if (!simRef.current) {
      const nodes = villages.map((v) => ({ ...v, r: radiusFor(v) }));
      const links = buildLinks(villages);

      const sim = forceSimulation(nodes)
        .force("link", forceLink(links).id((d) => d.id).distance(85).strength(0.12))
        .force("charge", forceManyBody().strength(-160))
        .force("collide", forceCollide((d) => d.r + 8))
        .force("center", forceCenter(width / 2, HEIGHT / 2))
        .force("x", forceX(width / 2).strength(0.03))
        .force("y", forceY(HEIGHT / 2).strength(0.03))
        .on("tick", forceRerender);

      simRef.current = sim;
      nodesRef.current = nodes;
      linksRef.current = links;
      prevStatusRef.current = Object.fromEntries(nodes.map((n) => [n.id, n.status]));
    } else {
      const byId = Object.fromEntries(villages.map((v) => [v.id, v]));
      const newRipples = [];
      nodesRef.current.forEach((n) => {
        const fresh = byId[n.id];
        if (!fresh) return;
        const wasAlert = prevStatusRef.current[n.id] === "alert";
        Object.assign(n, fresh, { r: radiusFor(fresh) });
        if (!wasAlert && fresh.status === "alert") {
          newRipples.push({ key: rippleKeyRef.current++, nodeId: n.id });
        }
        prevStatusRef.current[n.id] = fresh.status;
      });
      if (newRipples.length) setRipples((prev) => [...prev, ...newRipples]);
      simRef.current.alpha(0.15).restart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villages]);

  // Keep the centering forces in sync with the measured width.
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.force("center", forceCenter(width / 2, HEIGHT / 2));
    sim.force("x", forceX(width / 2).strength(0.03));
    sim.alpha(0.3).restart();
  }, [width]);

  useEffect(() => {
    return () => {
      simRef.current?.stop();
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      setHistory(null);
      return;
    }
    let cancelled = false;
    api
      .getVillageHistory(selectedId, 14)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function handlePointerDown(e, node) {
    const rect = svgRef.current.getBoundingClientRect();
    const transform = viewTransform;
    dragState.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    simRef.current.alphaTarget(0.25).restart();
    node.fx = node.x;
    node.fy = node.y;

    function handleMove(ev) {
      const state = dragState.current;
      if (!state) return;
      if (Math.abs(ev.clientX - state.startX) + Math.abs(ev.clientY - state.startY) > CLICK_DRAG_THRESHOLD) {
        state.moved = true;
      }
      // Invert the current pan/zoom transform so dragging stays accurate
      // even while the view is auto-focused on a simulated outbreak.
      node.fx = (ev.clientX - rect.left - transform.x) / transform.k;
      node.fy = (ev.clientY - rect.top - transform.y) / transform.k;
      forceRerender();
    }
    function handleUp() {
      simRef.current.alphaTarget(0);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      if (dragState.current && !dragState.current.moved) {
        setSelectedId(node.id);
      }
      dragState.current = null;
      // fx/fy stay set intentionally: the node stays exactly where it was dropped.
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  // Pan/zoom the graph to frame a simulated village and its direct neighbors.
  function handleSimulateStart(targetId) {
    const id = Number(targetId);
    const focusNode = nodesRef.current.find((n) => n.id === id);
    if (!focusNode) return;

    const neighborIds = new Set([id]);
    linksRef.current.forEach((link) => {
      const s = link.source;
      const t = link.target;
      const sId = typeof s === "object" ? s.id : s;
      const tId = typeof t === "object" ? t.id : t;
      if (sId === id) neighborIds.add(tId);
      if (tId === id) neighborIds.add(sId);
    });

    const focusNodes = nodesRef.current.filter((n) => neighborIds.has(n.id));
    const cx = focusNodes.reduce((sum, n) => sum + (n.x || 0), 0) / focusNodes.length;
    const cy = focusNodes.reduce((sum, n) => sum + (n.y || 0), 0) / focusNodes.length;

    setViewTransform({ x: width / 2 - cx * FOCUS_SCALE, y: HEIGHT / 2 - cy * FOCUS_SCALE, k: FOCUS_SCALE });

    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = setTimeout(() => {
      setViewTransform({ x: 0, y: 0, k: 1 });
    }, FOCUS_HOLD_MS);
  }

  const selectedNode = useMemo(
    () => nodesRef.current.find((n) => n.id === selectedId) || null,
    // nodesRef.current is mutated in place by d3, so re-derive whenever a tick/poll happens
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, villages],
  );
  const selectedAlert = selectedNode ? alerts.find((a) => a.village_id === selectedNode.id) : null;

  // Villages directly connected to an active-alert village get a "watch" ring.
  const watchIds = new Set();
  const alertIds = new Set(nodesRef.current.filter((n) => n.status === "alert").map((n) => n.id));
  linksRef.current.forEach((link) => {
    const s = link.source;
    const t = link.target;
    if (typeof s !== "object" || typeof t !== "object") return;
    if (alertIds.has(s.id) && t.status === "normal") watchIds.add(t.id);
    if (alertIds.has(t.id) && s.status === "normal") watchIds.add(s.id);
  });

  return (
    <div className="card cluster-network-view">
      <div className="card-header">
        <h2>
          <IconTopologyStar3 size={18} /> Cluster network
        </h2>
        <SimulateButton villages={villages} onStep={onStep} onStart={handleSimulateStart} />
      </div>
      <div className="section-sub" style={{ color: "#7a8896" }}>
        Drag a node to reposition it. Lines connect villages that share a pincode prefix.
      </div>

      <div ref={containerRef} style={{ position: "relative", width: "100%", height: HEIGHT, overflow: "hidden" }}>
        <svg ref={svgRef} width={width} height={HEIGHT} style={{ display: "block" }}>
          <g
            style={{
              transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.k})`,
              transformOrigin: "0 0",
              transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {linksRef.current.map((link, i) => {
              const s = link.source;
              const t = link.target;
              if (typeof s !== "object" || typeof t !== "object") return null;
              const risky = s.status === "alert" || t.status === "alert";
              return (
                <line
                  key={i}
                  className="cluster-link"
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={risky ? RISK_COLOR : "#2a3542"}
                  strokeWidth={risky ? 2.5 : 1}
                  opacity={risky ? 0.9 : 0.8}
                />
              );
            })}

            {nodesRef.current.map((node) => (
              <g key={node.id} style={{ cursor: "grab" }}>
                {watchIds.has(node.id) && (
                  <circle
                    cx={node.x || 0}
                    cy={node.y || 0}
                    r={node.r + 5}
                    fill="none"
                    className="watch-ring"
                  />
                )}
                <circle
                  cx={node.x || 0}
                  cy={node.y || 0}
                  r={node.r}
                  fill={STATUS_COLORS[node.status]}
                  stroke={node.id === selectedId ? "#e6edf3" : "rgba(255,255,255,0.15)"}
                  strokeWidth={node.id === selectedId ? 2 : 1}
                  className={`cluster-node ${dotClassName(node.status)}`}
                  onPointerDown={(e) => handlePointerDown(e, node)}
                />
                <text
                  x={node.x || 0}
                  y={(node.y || 0) + node.r + 13}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#8b98a8"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {node.name}
                </text>
              </g>
            ))}

            {ripples.map((ripple) => {
              const node = nodesRef.current.find((n) => n.id === ripple.nodeId);
              if (!node) return null;
              return (
                <circle
                  key={ripple.key}
                  cx={node.x || 0}
                  cy={node.y || 0}
                  r={node.r}
                  fill="none"
                  className="ripple-ring"
                  onAnimationEnd={() => setRipples((prev) => prev.filter((r) => r.key !== ripple.key))}
                />
              );
            })}
          </g>
        </svg>

        {selectedNode && (
          <div className="cluster-side-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedNode.name}</div>
              <button
                onClick={() => setSelectedId(null)}
                style={{ background: "none", border: "none", color: "#8b98a8", padding: 2 }}
              >
                <IconX size={16} />
              </button>
            </div>
            <span
              className="badge"
              style={{
                background: `${STATUS_COLORS[selectedNode.status]}22`,
                color: STATUS_COLORS[selectedNode.status],
                marginTop: 6,
              }}
            >
              {STATUS_LABELS[selectedNode.status]}
            </span>

            <div style={{ display: "flex", gap: 18, margin: "14px 0" }}>
              <div>
                <span className="stat-label" style={{ color: "#7a8896" }}>Today</span>
                <span className="stat-value sm" style={{ color: "#e6edf3" }}>{selectedNode.today_cases}</span>
              </div>
              <div>
                <span className="stat-label" style={{ color: "#7a8896" }}>Usual average</span>
                <span className="stat-value sm" style={{ color: "#e6edf3" }}>{selectedNode.baseline_mean}</span>
              </div>
            </div>

            {selectedAlert?.ai_explanation && (
              <div className="ai-callout cluster-ai-callout">
                <IconSparkles size={14} />
                <span>{selectedAlert.ai_explanation}</span>
              </div>
            )}

            <div style={{ fontSize: 11, color: "#7a8896", marginBottom: 6 }}>Last 14 days</div>
            <Sparkline history={history} />
          </div>
        )}
      </div>
    </div>
  );
}
