from flask import Flask
from app.config import Config


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    from app.blueprints.monitoring import monitoring_bp
    from app.blueprints.public_dashboard_react import public_dashboard_react_bp

    app.register_blueprint(monitoring_bp)
    app.register_blueprint(public_dashboard_react_bp)

    return app
