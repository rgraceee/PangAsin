from app.models.municipality import Municipality
from app.extensions import db


def seed():
    existing = Municipality.query.count()
    if existing:
        print(f"{existing} municipalities already present; no changes.")
        return
    db.session.commit()
    print("No seed data required.")