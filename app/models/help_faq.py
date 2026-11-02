# WHAT: Help Center FAQ items managed by SuperAdmin.
# WHY: Dedicated table for full CRUD (create, edit, delete, reorder,
#      category) of public Help Center FAQ items.
from app.extensions import db
from datetime import datetime


class HelpFaq(db.Model):
    __tablename__ = "help_faqs"

    id = db.Column(db.Integer, primary_key=True, nullable=False)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(length=100), nullable=False, server_default="General")
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)

    def serialize(self):
        return {
            "id": self.id,
            "question": self.question,
            "answer": self.answer,
            "category": self.category,
            "sort_order": self.sort_order,
            "active": self.active,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
