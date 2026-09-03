from flask import Flask, jsonify, request
from app.config import Config
from app.extensions import db, migrate, login_manager


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    @login_manager.unauthorized_handler
    def unauthorized():
        if request.path.startswith("/api/") or request.accept_mimetypes.accept_json:
            return jsonify({"error": "Unauthorized"}), 401
        return jsonify({"error": "Unauthorized"}), 401

    from app import models  # noqa: F401  (register models with SQLAlchemy)

    from app.blueprints.monitoring import monitoring_bp
    from app.blueprints.public_dashboard_react import public_dashboard_react_bp
    from app.blueprints.auth_api import auth_api_bp
    from app.blueprints.encoder_api import encoder_api_bp
    from app.blueprints.admin_api import admin_api_bp
    from app.blueprints.forecast_api import forecast_api_bp
    from app.blueprints.reports_api import reports_api_bp

    app.register_blueprint(monitoring_bp)
    app.register_blueprint(public_dashboard_react_bp)
    app.register_blueprint(auth_api_bp)
    app.register_blueprint(encoder_api_bp)
    app.register_blueprint(admin_api_bp)
    app.register_blueprint(forecast_api_bp)
    app.register_blueprint(reports_api_bp)

    return app
