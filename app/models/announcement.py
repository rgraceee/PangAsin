# WHAT: Slim dismissible announcement banner shown on public, admin and encoder
#       layouts. Nothing renders when no announcement is active.
# WHY: Lets SuperAdmin broadcast a message across all roles from one place.
from app.extensions import db
from datetime import datetime


class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.Integer, primary_key=True, nullable=False)
    message = db.Column(db.Text, nullable=False)
    level = db.Column(db.String(length=20), nullable=False, server_default="info")
    active = db.Column(db.Boolean, nullable=False, server_default="false")
    starts_at = db.Column(db.DateTime, nullable=True)
    ends_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)

    def _fmt(self, v):
        if v is None:
            return None
        return v.isoformat() + "Z" if hasattr(v, "isoformat") else str(v)

    def serialize(self):
        return {
            "id": self.id,
            "message": self.message,
            "level": self.level,
            "active": self.active,
            "starts_at": self._fmt(self.starts_at),
            "ends_at": self._fmt(self.ends_at),
            "updated_at": self._fmt(self.updated_at),
        }
