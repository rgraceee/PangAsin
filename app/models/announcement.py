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

    def serialize(self):
        return {
            "id": self.id,
            "message": self.message,
            "level": self.level,
            "active": self.active,
            "starts_at": self.starts_at.isoformat() + "Z" if self.starts_at else None,
            "ends_at": self.ends_at.isoformat() + "Z" if self.ends_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
