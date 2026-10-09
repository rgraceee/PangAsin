import csv, os
from sqlalchemy import text
from app import create_app
from app.extensions import db

os.makedirs(r"C:\PangAsin-backups", exist_ok=True)
app = create_app()
with app.app_context():
    for t in ["production_records", "forecast_runs", "forecast_points"]:
        res = db.session.execute(text(f"SELECT * FROM {t}"))
        with open(rf"C:\PangAsin-backups\{t}_before_mt.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(res.keys())
            w.writerows(res.fetchall())
        print(t, "saved")