import { useState } from "react";
import { IconClipboardPlus } from "@tabler/icons-react";
import { api } from "../api/client";
import { todayLocalISO } from "../dateUtils";

const SYMPTOMS = [
  { value: "diarrhoea", label: "Diarrhoea" },
  { value: "vomiting", label: "Vomiting" },
  { value: "fever", label: "Fever" },
  { value: "other", label: "Other" },
];

const today = todayLocalISO;

export default function ReportForm({ villages, onSubmitted }) {
  const [villageId, setVillageId] = useState("");
  const [symptomType, setSymptomType] = useState("diarrhoea");
  const [cases, setCases] = useState("");
  const [date, setDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const resolvedVillageId = villageId || (villages[0] && villages[0].id) || "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!resolvedVillageId || !cases) return;

    setSubmitting(true);
    setMessage(null);
    try {
      await api.createReport({
        village_id: Number(resolvedVillageId),
        symptom_type: symptomType,
        cases: Number(cases),
        report_date: date,
      });
      setMessage({ type: "ok", text: "Report submitted." });
      setCases("");
      onSubmitted?.();
    } catch (err) {
      setMessage({ type: "err", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>
          <IconClipboardPlus size={18} /> Report a case
        </h2>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={fieldLabel}>
          Village / pincode
          <select
            value={resolvedVillageId}
            onChange={(e) => setVillageId(e.target.value)}
            style={inputStyle}
          >
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.pincode}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldLabel}>
          Symptom type
          <select value={symptomType} onChange={(e) => setSymptomType(e.target.value)} style={inputStyle}>
            {SYMPTOMS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldLabel}>
          Number of cases
          <input
            type="number"
            min="1"
            required
            value={cases}
            onChange={(e) => setCases(e.target.value)}
            style={inputStyle}
            placeholder="e.g. 4"
          />
        </label>

        <label style={fieldLabel}>
          Date
          <input
            type="date"
            required
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 4 }}>
          {submitting ? "Submitting…" : "Submit report"}
        </button>

        {message && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: message.type === "ok" ? "var(--green)" : "var(--red)",
              animation: "card-in 0.25s ease",
            }}
          >
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
}

const fieldLabel = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  color: "#1e2a3a",
  fontWeight: 500,
};

const inputStyle = {
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  fontSize: 14,
  background: "#fbfdff",
  color: "#1e2a3a",
};
