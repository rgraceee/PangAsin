# WHAT: Immutable trail of sensitive admin actions (who changed what and when).
# WHY: Municipality, barangay, user and boundary changes are destructive; the
#      audit trail makes them reviewable without relying on application logs.
from datetime import datetime

from app.extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    # WHAT: Deliberately not a foreign key.
    # WHY: Deleting a user or municipality must never fail (or erase history)
    #      because an audit row still points at it. The email is denormalized.
    actor_id = db.Column(db.Integer, nullable=True, index=True)
    actor_email = db.Column(db.String(150), nullable=True)
    action = db.Column(db.String(80), nullable=False, index=True)
    entity_type = db.Column(db.String(50), nullable=False, index=True)
    entity_id = db.Column(db.Integer, nullable=True, index=True)
    summary = db.Column(db.String(255), nullable=True)
    details = db.Column(db.JSON, nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    def serialize(self):
        return {
            "id": self.id,
            "actor_id": self.actor_id,
            "actor_email": self.actor_email,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "summary": self.summary,
            "details": self.details or {},
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }
