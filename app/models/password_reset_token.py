# WHAT: Single-use password reset tokens na naka-hash sa database.
# WHY: Ang plain token ay nasa email link lang; kapag na-leak ang database,
#      hindi pa rin magagamit ang mga hash para mag-reset ng password.
from datetime import datetime

from app.extensions import db


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False, index=True
    )

    user = db.relationship("User", backref=db.backref("password_reset_tokens", lazy=True))

    def is_expired(self, now=None):
        return self.expires_at <= (now or datetime.utcnow())

    def is_usable(self, now=None):
        return self.used_at is None and not self.is_expired(now)
