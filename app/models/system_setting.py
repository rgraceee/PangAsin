# WHAT: Typed, validated runtime settings read by the app with current behavior
#       as defaults. SuperAdmin can change them; every write is audited.
# WHY: Centralises knobs (password length, lockout, forgot-password validity,
#      email subject/template, etc.) so the app behaves identically until a
#      SuperAdmin edits a setting, and every change is recorded.
from app.extensions import db
from datetime import datetime


class SystemSetting(db.Model):
    __tablename__ = "system_settings"

    key = db.Column(db.String(length=100), primary_key=True, nullable=False)
    value = db.Column(db.JSON, nullable=False, server_default="{}")
    type = db.Column(db.String(length=30), nullable=False, server_default="string")
    updated_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)

    def serialize(self):
        return {
            "key": self.key,
            "value": self.value,
            "type": self.type,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
