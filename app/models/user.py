# WHAT: User table — admin at encoder accounts (flask_login UserMixin).
# WHY: Ang role ang nagde-determine kung anong API ang pwede i-access ng user.
from app.extensions import db, login_manager
from datetime import datetime
from flask_login import UserMixin


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Enum("admin", "encoder", "superadmin", name="user_role_enum"), nullable=False)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=True)
    status = db.Column(db.Enum("active", "inactive", name="user_status_enum"), default="active", nullable=False)
    must_change_password = db.Column(db.Boolean, default=False, nullable=False)
    # WHAT: Bilang ng nabigong pag-login.
    # WHY: Kapag nahinto sa 5, i-lock ang account para 15 minuto para iwasan
    #      ang password-guessing attacks.
    failed_login_count = db.Column(db.Integer, default=0, nullable=False)
    # WHAT: Oras hanggang kailan ang account ay i-lock.
    # WHY: Automatikong nabubuksan pagkalipas ng 15 minuto; admin pede ring
    #      maingat na ma-unlock manually.
    locked_until = db.Column(db.DateTime, nullable=True)
    # WHAT: Version marker na naka-store din sa Flask session.
    # WHY: Password reset increments this para ma-invalidate ang lahat ng
    #      existing sessions ng account nang hindi kailangan ng server-side store.
    session_version = db.Column(db.Integer, default=0, server_default="0", nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.Index("uq_users_email_lower", db.func.lower(email), unique=True),
    )

    production_records = db.relationship("ProductionRecord", foreign_keys="ProductionRecord.submitted_by", backref="submitter", lazy=True)

    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)

    @property
    def is_active(self):
        # WHAT: Admin-only users (status='inactive') cannot sign in.
        # WHY: Deactivated accounts stay in the DB but are unusable until an
        #      admin reactivates them. Flask-Login uses this flag.
        return self.status == "active"

    def is_locked(self):
        # WHAT: True kung nasa lockout period ang account.
        # WHY: Mabago na ang lockout sa login handler para mapanatiling
        #      consistent ang state.
        if self.locked_until is None:
            return False
        return datetime.utcnow() < self.locked_until

    def lock(self, minutes=15):
        # WHAT: I-lock ang account para sa `minutes` at i-reset ang failed
        #      count. Tinutukoy ng login handler ang oras ng pag-unlock.
        # WHY: Iwasan ang pag-uulit ng pag-subcribe ng password.
        self.locked_until = datetime.utcnow() + timedelta(minutes=minutes)
        self.failed_login_count = 0

    def unlock(self):
        # WHAT: Buksan ang account at i-reset ang counter.
        # WHY: Ginagamit ng admin kapag na-resolve na ang isyu ng account.
        self.locked_until = None
        self.failed_login_count = 0

    def record_failed_login(self):
        # WHAT: Idagdag ang bilang ng pagkakamali at i-lock kung nakakaantong
        #      sa limit (5) para 15 minuto.
        # WHY: Iwasan ang pag-uulit ng password sa pamamagitan ng pagbabad
        #      ng pag-akyat ng bilang ng pagkakamali.
        self.failed_login_count += 1
        if self.failed_login_count >= 5:
            self.lock(minutes=15)
        return self.failed_login_count

    def record_successful_login(self):
        # WHAT: I-reset ang failed count at i-set ang last_login bawat
        #      maihiang pag-login.
        # WHY: Malinaw ang estado ng account matapos ang makatwid na login.
        self.failed_login_count = 0
        self.locked_until = None
        self.last_login = datetime.utcnow()


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))