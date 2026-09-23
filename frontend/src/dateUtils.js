// Local (not UTC) calendar date as YYYY-MM-DD, matching the backend's
// date.today() which uses the server's local timezone. Date.toISOString()
// converts to UTC first, which drifts to the wrong day whenever the local
// timezone is offset from UTC near midnight.
export function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
