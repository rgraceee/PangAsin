# WHAT: Editable public/help content managed by SuperAdmin.
# WHY: Privacy Policy, Terms, About and FAQ text live in the database so a
#      SuperAdmin can edit them without a redeploy. Missing/empty keys fall
#      back to bundled defaults with the current wording, so nothing visible
#      changes until a SuperAdmin edits a key.
from app.extensions import db
from datetime import datetime


class SiteContent(db.Model):
    __tablename__ = "site_content"

    key = db.Column(db.String(length=100), primary_key=True, nullable=False)
    data = db.Column(db.JSON, nullable=False, server_default="{}")
    version = db.Column(db.Integer, nullable=False, default=1)
    effective_date = db.Column(db.DateTime, nullable=True)
    updated_by = db.Column(db.Integer, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)

    def serialize(self):
        return {
            "key": self.key,
            "data": self.data or {},
            "version": self.version,
            "effective_date": self.effective_date.isoformat() + "Z" if self.effective_date else None,
            "updated_by": self.updated_by,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
