from datetime import datetime

from app.extensions import db


class EmailChangeToken(db.Model):
    __tablename__ = "email_change_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    current_email = db.Column(db.String(150), nullable=False)
    new_email = db.Column(db.String(150), nullable=False)
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False, index=True
    )

    user = db.relationship(
        "User",
        backref=db.backref("email_change_tokens", lazy=True),
    )

    def is_expired(self, now=None):
        return self.expires_at <= (now or datetime.utcnow())
