import random
from datetime import date, timedelta

VILLAGES = [
    ("Hinjawadi", "411057", 18.5913, 73.7389),
    ("Wagholi", "411014", 18.5793, 73.9856),
    ("Kharadi", "411014", 18.5515, 73.9430),
    ("Vadgaon Sheri", "411014", 18.5555, 73.9200),
    ("Lohegaon", "411032", 18.5900, 73.9200),
    ("Manjari", "412307", 18.5100, 73.9700),
    ("Uruli Kanchan", "412202", 18.4550, 74.0100),
    ("Loni Kalbhor", "412201", 18.4350, 73.8700),
    ("Saswad", "412301", 18.3400, 74.0300),
    ("Bhor", "412206", 18.1600, 73.8500),
    ("Velhe", "412213", 18.2200, 73.6600),
    ("Shirur", "412210", 18.8300, 74.3700),
    ("Daund", "412214", 18.4600, 74.5800),
    ("Junnar", "410502", 19.2100, 73.8800),
    ("Ambegaon", "410509", 19.0900, 73.9100),
    ("Rajgurunagar", "410505", 18.8700, 73.8300),
    ("Talegaon", "410507", 18.7300, 73.6700),
    ("Chakan", "410501", 18.7600, 73.8500),
]

SYMPTOMS = ["diarrhoea", "vomiting", "fever", "other"]
HISTORY_DAYS = 30


def seed_if_empty(conn):
    count = conn.execute("SELECT COUNT(*) AS c FROM villages").fetchone()["c"]
    if count > 0:
        return

    rng = random.Random(42)
    today = date.today()

    village_ids = []
    for name, pincode, lat, lng in VILLAGES:
        cur = conn.execute(
            "INSERT INTO villages (name, pincode, lat, lng) VALUES (?, ?, ?, ?)",
            (name, pincode, lat, lng),
        )
        village_ids.append(cur.lastrowid)

    for vid in village_ids:
        baseline = rng.randint(3, 12)
        for i in range(HISTORY_DAYS, 0, -1):
            day = today - timedelta(days=i)
            noise = rng.gauss(0, baseline * 0.35)
            cases = max(0, round(baseline + noise))
            if cases == 0:
                continue
            symptom = rng.choice(SYMPTOMS)
            conn.execute(
                "INSERT INTO reports (village_id, symptom_type, cases, report_date) "
                "VALUES (?, ?, ?, ?)",
                (vid, symptom, cases, day.isoformat()),
            )

    conn.commit()
