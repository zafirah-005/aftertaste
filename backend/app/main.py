import statistics
from datetime import date, timedelta

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection, init_db
from .detection import run_detection
from .models import AlertOut, AlertStatusUpdate, HistoryPoint, ReportIn, ReportOut, VillageOut
from .seed import seed_if_empty

app = FastAPI(title="Aftertaste API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    conn = get_connection()
    try:
        seed_if_empty(conn)
    finally:
        conn.close()


@app.get("/api/villages", response_model=list[VillageOut])
def list_villages():
    conn = get_connection()
    try:
        results = run_detection(conn)
        out = []
        for r in results:
            v = r["village"]
            total_row = conn.execute(
                "SELECT COALESCE(SUM(cases), 0) AS total FROM reports WHERE village_id = ?",
                (v["id"],),
            ).fetchone()
            out.append(
                VillageOut(
                    id=v["id"],
                    name=v["name"],
                    pincode=v["pincode"],
                    lat=v["lat"],
                    lng=v["lng"],
                    today_cases=r["today_cases"],
                    baseline_mean=r["baseline_mean"],
                    z_score=r["z_score"],
                    status=r["status"],
                    confidence=r["confidence"],
                    total_cases=total_row["total"],
                )
            )
        return out
    finally:
        conn.close()


@app.get("/api/villages/{village_id}/history", response_model=list[HistoryPoint])
def village_history(village_id: int, days: int = Query(30, ge=2, le=90)):
    conn = get_connection()
    try:
        village = conn.execute("SELECT * FROM villages WHERE id = ?", (village_id,)).fetchone()
        if not village:
            raise HTTPException(status_code=404, detail="Village not found")

        end = date.today()
        start = end - timedelta(days=days - 1)
        rows = conn.execute(
            "SELECT report_date, SUM(cases) AS total FROM reports "
            "WHERE village_id = ? AND report_date BETWEEN ? AND ? GROUP BY report_date",
            (village_id, start.isoformat(), end.isoformat()),
        ).fetchall()
        totals_by_date = {r["report_date"]: r["total"] for r in rows}

        all_days = [start + timedelta(days=i) for i in range(days)]
        daily_values = [totals_by_date.get(d.isoformat(), 0) for d in all_days]

        baseline_values = daily_values[:-1] if len(daily_values) > 1 else daily_values
        baseline_mean = statistics.mean(baseline_values) if baseline_values else 0.0

        return [
            HistoryPoint(date=d.isoformat(), cases=val, expected=round(baseline_mean, 2))
            for d, val in zip(all_days, daily_values)
        ]
    finally:
        conn.close()


@app.post("/api/reports", response_model=ReportOut, status_code=201)
def create_report(report: ReportIn):
    conn = get_connection()
    try:
        village = conn.execute("SELECT id FROM villages WHERE id = ?", (report.village_id,)).fetchone()
        if not village:
            raise HTTPException(status_code=404, detail="Village not found")

        cur = conn.execute(
            "INSERT INTO reports (village_id, symptom_type, cases, report_date) VALUES (?, ?, ?, ?)",
            (report.village_id, report.symptom_type, report.cases, report.report_date.isoformat()),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (cur.lastrowid,)).fetchone()

        # Keep alerts fresh immediately, not just on the next poll.
        run_detection(conn)

        return ReportOut(**dict(row))
    finally:
        conn.close()


@app.get("/api/alerts", response_model=list[AlertOut])
def list_alerts(status: str | None = Query(None)):
    conn = get_connection()
    try:
        query = (
            "SELECT alerts.*, villages.name AS village_name FROM alerts "
            "JOIN villages ON villages.id = alerts.village_id"
        )
        params: tuple = ()
        if status:
            query += " WHERE alerts.status = ?"
            params = (status,)
        query += " ORDER BY alerts.created_at DESC"

        rows = conn.execute(query, params).fetchall()
        return [AlertOut(**dict(r)) for r in rows]
    finally:
        conn.close()


@app.patch("/api/alerts/{alert_id}", response_model=AlertOut)
def update_alert_status(alert_id: int, update: AlertStatusUpdate):
    conn = get_connection()
    try:
        existing = conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Alert not found")

        conn.execute("UPDATE alerts SET status = ? WHERE id = ?", (update.status, alert_id))
        conn.commit()

        row = conn.execute(
            "SELECT alerts.*, villages.name AS village_name FROM alerts "
            "JOIN villages ON villages.id = alerts.village_id WHERE alerts.id = ?",
            (alert_id,),
        ).fetchone()
        return AlertOut(**dict(row))
    finally:
        conn.close()
