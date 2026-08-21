from app.models.municipality import Municipality
from app.extensions import db

NAMES = [
    "Alaminos City",
    "Anda",
    "Bani",
    "Bolinao",
    "Dasol",
    "Infanta",
    "San Fabian",
]


def seed():
    for name in NAMES:
        existing = Municipality.query.filter_by(name=name).first()
        if not existing:
            m = Municipality(name=name)
            db.session.add(m)
    db.session.commit()
    print(f"Ensured {len(NAMES)} municipalities exist.")
