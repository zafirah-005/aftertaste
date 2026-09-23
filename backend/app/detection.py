import math
import statistics
from datetime import date, timedelta

from .ai_explain import generate_explanation

BASELINE_WINDOW_DAYS = 14
RISING_Z = 1.5
ALERT_Z = 3.0
CLUSTER_MIN_VILLAGES = 2


def _norm_cdf(z: float) -> float:
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def _confidence_from_z(z: float) -> float:
    if z <= 0:
        return round(_norm_cdf(z) * 100, 1)
    return min(99.9, round(_norm_cdf(z) * 100, 1))


def _daily_total(conn, village_id: int, day: date) -> int:
    row = conn.execute(
        "SELECT COALESCE(SUM(cases), 0) AS total FROM reports "
        "WHERE village_id = ? AND report_date = ?",
        (village_id, day.isoformat()),
    ).fetchone()
    return row["total"] if row else 0


def village_stats(conn, village_id: int, today: date | None = None) -> dict:
    """Compute today's total, rolling baseline, z-score, status and confidence
    for a single village using a simple z-score test against the trailing
    BASELINE_WINDOW_DAYS of daily totals."""
    today = today or date.today()

    baseline_days = [today - timedelta(days=i) for i in range(1, BASELINE_WINDOW_DAYS + 1)]
    baseline_totals = [_daily_total(conn, village_id, d) for d in baseline_days]

    mean = statistics.mean(baseline_totals) if baseline_totals else 0.0
    std = statistics.pstdev(baseline_totals) if len(baseline_totals) > 1 else 0.0
    std = max(std, 1.0)  # floor to avoid divide-by-zero / oversensitivity on quiet villages

    today_total = _daily_total(conn, village_id, today)
    z = (today_total - mean) / std

    if z >= ALERT_Z:
        status = "alert"
    elif z >= RISING_Z:
        status = "rising"
    else:
        status = "normal"

    return {
        "today_cases": today_total,
        "baseline_mean": round(mean, 2),
        "z_score": round(z, 2),
        "status": status,
        "confidence": _confidence_from_z(z),
    }


def _spike_reason(name: str, stats: dict) -> str:
    if stats["status"] == "alert":
        return (
            f"{name} reported {stats['today_cases']} cases today, far above its usual "
            f"average of {stats['baseline_mean']:.1f} — a statistically significant spike "
            f"(z-score {stats['z_score']:.1f})."
        )
    return (
        f"{name} reported {stats['today_cases']} cases today, trending above its usual "
        f"average of {stats['baseline_mean']:.1f}."
    )


def _get_existing_alert(conn, village_id: int, alert_type: str, alert_date: str):
    return conn.execute(
        "SELECT * FROM alerts WHERE village_id = ? AND alert_type = ? AND alert_date = ?",
        (village_id, alert_type, alert_date),
    ).fetchone()


def _dominant_symptom(conn, village_id: int, day: date) -> str | None:
    row = conn.execute(
        "SELECT symptom_type FROM reports WHERE village_id = ? AND report_date = ? "
        "GROUP BY symptom_type ORDER BY SUM(cases) DESC LIMIT 1",
        (village_id, day.isoformat()),
    ).fetchone()
    return row["symptom_type"] if row else None


def _upsert_alert(conn, village_id: int, alert_type: str, reason: str, confidence: float, alert_date: str, ai_context: dict):
    existing = _get_existing_alert(conn, village_id, alert_type, alert_date)
    if existing:
        conn.execute(
            "UPDATE alerts SET reason = ?, confidence = ? WHERE id = ?",
            (reason, confidence, existing["id"]),
        )
    else:
        # Only ask Gemini once, at the moment the alert is first created.
        ai_explanation = generate_explanation(ai_context)
        conn.execute(
            "INSERT INTO alerts (village_id, alert_type, reason, confidence, status, alert_date, ai_explanation) "
            "VALUES (?, ?, ?, ?, 'needs_checking', ?, ?)",
            (village_id, alert_type, reason, confidence, alert_date, ai_explanation),
        )


def run_detection(conn, today: date | None = None) -> list[dict]:
    """Recompute status for every village, create/update alert records for any
    village that is spiking on its own, or that is rising together with other
    villages that share a pincode prefix. Returns per-village stats."""
    today = today or date.today()
    today_str = today.isoformat()

    villages = conn.execute("SELECT * FROM villages").fetchall()

    results = {}
    for v in villages:
        stats = village_stats(conn, v["id"], today)
        results[v["id"]] = {"village": v, **stats}

        if stats["status"] in ("alert", "rising"):
            _upsert_alert(
                conn,
                v["id"],
                "spike",
                _spike_reason(v["name"], stats),
                stats["confidence"],
                today_str,
                ai_context={
                    "village_name": v["name"],
                    "today_cases": stats["today_cases"],
                    "baseline_mean": stats["baseline_mean"],
                    "symptom_type": _dominant_symptom(conn, v["id"], today),
                    "nearby_villages": None,
                },
            )

    # Cluster detection: group by pincode prefix (first 3 digits)
    groups: dict[str, list] = {}
    for vid, r in results.items():
        prefix = r["village"]["pincode"][:3]
        groups.setdefault(prefix, []).append(r)

    for prefix, members in groups.items():
        rising_members = [r for r in members if r["status"] in ("alert", "rising")]
        if len(rising_members) >= CLUSTER_MIN_VILLAGES:
            names = [r["village"]["name"] for r in rising_members]
            avg_conf = round(sum(r["confidence"] for r in rising_members) / len(rising_members), 1)
            for r in rising_members:
                others = [n for n in names if n != r["village"]["name"]]
                others_str = " and ".join(others) if len(others) <= 2 else f"{len(others)} nearby villages"
                reason = (
                    f"{r['village']['name']} is rising alongside {others_str} "
                    f"(shared pincode prefix {prefix}) — a possible localized outbreak cluster."
                )
                _upsert_alert(
                    conn,
                    r["village"]["id"],
                    "cluster",
                    reason,
                    avg_conf,
                    today_str,
                    ai_context={
                        "village_name": r["village"]["name"],
                        "today_cases": r["today_cases"],
                        "baseline_mean": r["baseline_mean"],
                        "symptom_type": _dominant_symptom(conn, r["village"]["id"], today),
                        "nearby_villages": others,
                    },
                )

    conn.commit()
    return list(results.values())
