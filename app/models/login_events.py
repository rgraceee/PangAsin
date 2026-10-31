# WHAT: Log ng bawat pagkatok sa login (successful o hindi).
# WHY: Mahalaga sa audit upang ma-monitor ang pag-akses sa sistema, makita
#      ang pag-try-try ng password, at malaman kung sino ang nag-login at kailan.
#      ``user_id`` ay hindi foreign key para manatili ang history kahit
#      na-delete ang account.
from datetime import datetime

from app.extensions import db


class LoginEvent(db.Model):
    __tablename__ = "login_events"

    id = db.Column(db.Integer, primary_key=True)
    # WHAT: Deliberately not a foreign key — history must survive account deletion.
    user_id = db.Column(db.Integer, nullable=True, index=True)
    # WHAT: Email na ginamit sa pag-login (kahit wala pang account).
    email = db.Column(db.String(150), nullable=True)
    # WHAT: Totoo kung maihiang ang pag-login, hindi kung nawalan ng access.
    success = db.Column(db.Boolean, nullable=False)
    ip = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    def serialize(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "email": self.email,
            "success": self.success,
            "ip": self.ip,
            "user_agent": self.user_agent,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }
