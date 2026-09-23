import { useState } from "react";
import { IconVirus } from "@tabler/icons-react";
import { api } from "../api/client";
import { todayLocalISO } from "../dateUtils";

const BURST_STEPS = [12, 20, 30, 42, 55];
const STEP_DELAY_MS = 900;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SimulateButton({ villages, onStep, onStart }) {
  const [villageId, setVillageId] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const targetId = villageId || (villages[0] && villages[0].id) || "";

  async function runSimulation() {
    if (!targetId || running) return;
    setRunning(true);
    setProgress(0);
    onStart?.(targetId);

    const today = todayLocalISO();

    for (let i = 0; i < BURST_STEPS.length; i++) {
      try {
        await api.createReport({
          village_id: Number(targetId),
          symptom_type: "diarrhoea",
          cases: BURST_STEPS[i],
          report_date: today,
        });
      } catch {
        // keep the burst going even if one step fails
      }
      setProgress(i + 1);
      await onStep?.();
      if (i < BURST_STEPS.length - 1) await sleep(STEP_DELAY_MS);
    }

    setRunning(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <select
        value={targetId}
        onChange={(e) => setVillageId(e.target.value)}
        disabled={running}
        style={{
          padding: "9px 10px",
          borderRadius: 10,
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
      <button className="btn btn-primary btn-hero" onClick={runSimulation} disabled={running}>
        <span className="pulse-icon">
          <IconVirus size={18} />
        </span>
        {running ? `Simulating… (${progress}/${BURST_STEPS.length})` : "Simulate outbreak"}
      </button>
    </div>
  );
}
