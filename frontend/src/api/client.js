const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getVillages: () => request("/api/villages"),
  getVillageHistory: (villageId, days = 30) =>
    request(`/api/villages/${villageId}/history?days=${days}`),
  getAlerts: (status) => request(`/api/alerts${status ? `?status=${status}` : ""}`),
  updateAlertStatus: (alertId, status) =>
    request(`/api/alerts/${alertId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  createReport: (report) =>
    request("/api/reports", { method: "POST", body: JSON.stringify(report) }),
};
