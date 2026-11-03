# WHAT: Log ng bawat password reset request at kung nabigyan ng email.
# WHY: May record ang admin kung nakapadala ba ng reset link at paano nakatugma ang token sa pag-gamit.
from datetime import datetime

from app.extensions import db


class PasswordResetRequest(db.Model):
    __tablename__ = "password_reset_requests"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False, index=True
    )
    email_status = db.Column(
        db.String(length=10), nullable=False, index=True
    )
    used_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref=db.backref("password_reset_requests", lazy=True))
