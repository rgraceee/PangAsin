# WHAT: Read-only CSV snapshot of key tables before a data import.
# WHY: The synthetic master-list load writes to `producers`; a timestamped dump lets
#      us restore the previous state without overwriting earlier backups.

import csv
import os
from datetime import datetime

from sqlalchemy import text

from app import create_app
from app.extensions import db


TABLES = ["production_records", "forecast_runs", "forecast_points", "producers", "barangays"]

app = create_app()
with app.app_context():
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = rf"C:\PangAsin-backups\{stamp}_before_import"
    os.makedirs(out_dir, exist_ok=True)
    for table in TABLES:
        result = db.session.execute(text(f"SELECT * FROM {table}"))
        with open(os.path.join(out_dir, f"{table}.csv"), "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(result.keys())
            writer.writerows(result.fetchall())
        print(table, "saved")
    print("backup dir:", out_dir)
