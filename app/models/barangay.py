# WHAT: Barangay table — sub-area ng isang municipality.
# WHY: Bawat production record ay naka-link sa barangay para mas detalyado ang reporting.
from app.extensions import db
from datetime import datetime


class Barangay(db.Model):
    __tablename__ = "barangays"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("municipality_id", "name", name="uq_barangays_municipality_name"),
    )

    def __repr__(self):
        return f"<Barangay {self.name} (municipality_id={self.municipality_id})>"