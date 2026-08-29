from app.extensions import db
from datetime import datetime


class ValidationHistory(db.Model):
    __tablename__ = "validation_history"

    id = db.Column(db.Integer, primary_key=True)
    production_record_id = db.Column(db.Integer, db.ForeignKey("production_records.id"), nullable=False)
    previous_status = db.Column(db.Enum("draft", "pending", "approved", "rejected", name="record_status"), nullable=False)
    new_status = db.Column(db.Enum("draft", "pending", "approved", "rejected", name="record_status"), nullable=False)
    action = db.Column(db.Enum("submitted", "approved", "rejected", "resubmitted", name="validation_action"), nullable=False)
    reviewer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
