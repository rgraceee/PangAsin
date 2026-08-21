from app import create_app
from app.seed.seed_municipalities import seed as seed_municipalities
from app.seed.seed_demo_data import seed as seed_demo_data
from app.extensions import db

app = create_app()
with app.app_context():
    db.create_all()
    seed_municipalities()
    seed_demo_data()
    print("Database initialized and seeded.")
