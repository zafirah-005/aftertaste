import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "aftertaste.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS villages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pincode TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    village_id INTEGER NOT NULL REFERENCES villages(id),
    symptom_type TEXT NOT NULL,
    cases INTEGER NOT NULL,
    report_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    village_id INTEGER NOT NULL REFERENCES villages(id),
    alert_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'needs_checking',
    alert_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ai_explanation TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_village_date ON reports(village_id, report_date);
CREATE INDEX IF NOT EXISTS idx_alerts_village_date ON alerts(village_id, alert_date, alert_type);
"""


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        try:
            conn.execute("ALTER TABLE alerts ADD COLUMN ai_explanation TEXT")
        except sqlite3.OperationalError:
            pass  # column already exists on a pre-existing database
        conn.commit()
    finally:
        conn.close()
