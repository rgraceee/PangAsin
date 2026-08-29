from app.models.municipality import Municipality
from app.extensions import db

MUNICIPALITIES = [
    {"name": "Alaminos City", "latitude": 16.1619, "longitude": 119.9803},
    {"name": "Anda", "latitude": 16.2894, "longitude": 119.9531},
    {"name": "Bani", "latitude": 16.1939, "longitude": 119.8689},
    {"name": "Bolinao", "latitude": 16.3856, "longitude": 119.8897},
    {"name": "Dasol", "latitude": 16.0556, "longitude": 119.8767},
    {"name": "Infanta", "latitude": 16.3208, "longitude": 119.9033},
    {"name": "San Fabian", "latitude": 16.1097, "longitude": 120.0781},
]


def seed():
    for m in MUNICIPALITIES:
        existing = Municipality.query.filter_by(name=m["name"]).first()
        if not existing:
            municipality = Municipality(
                name=m["name"],
                latitude=m["latitude"],
                longitude=m["longitude"],
                status="active",
            )
            db.session.add(municipality)
    db.session.commit()
    print(f"Seeded {len(MUNICIPALITIES)} municipalities.")
