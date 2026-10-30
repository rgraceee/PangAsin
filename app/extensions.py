from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_mail import Mail

db = SQLAlchemy()
migrate = Migrate()
mail = Mail()
login_manager = LoginManager()
login_manager.login_view = "auth_api.login"
login_manager.login_message_category = "info"
