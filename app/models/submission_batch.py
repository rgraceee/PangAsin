from app.extensions import db
from datetime import datetime


class SubmissionBatch(db.Model):
    __tablename__ = "submission_batches"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    total_rows = db.Column(db.Integer, nullable=False)
    valid_rows = db.Column(db.Integer, default=0, nullable=False)
    invalid_rows = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.Enum("uploaded", "processing", "completed", "failed", name="batch_status"), default="uploaded", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    processed_at = db.Column(db.DateTime, nullable=True)
