from flask import Flask
from app.config import Config
from app.extensions import db, migrate, login_manager
from app.models.user import User
from app.models.municipality import Municipality
from app.models.production_record import ProductionRecord
from app.models.report import Report
from app.models.submission_batch import SubmissionBatch
from app.models.validation_history import ValidationHistory
from app.models.demand_benchmark import DemandBenchmark
from app.models.forecast_run import ForecastRun
from app.models.forecast_result import ForecastResult
from app.models.report_file import ReportFile


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    from app.blueprints.auth import auth_bp
    from app.blueprints.access_management import admin_access_bp
    from app.blueprints.data_collection import encoder_bp
    from app.blueprints.validation import validation_bp
    from app.blueprints.data_quality import data_quality_bp
    from app.blueprints.monitoring import monitoring_bp
    from app.blueprints.gis_map import gis_map_bp
    from app.blueprints.analytics import analytics_bp
    from app.blueprints.forecasting import forecasting_bp
    from app.blueprints.reporting import reporting_bp
    from app.blueprints.public_dashboard import public_dashboard_bp
    from app.blueprints.public_dashboard_react import public_dashboard_react_bp
    from app.blueprints.trends import trends_bp
    from app.blueprints.comparison import comparison_bp
    from app.blueprints.map_insights import map_insights_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_access_bp)
    app.register_blueprint(encoder_bp)
    app.register_blueprint(validation_bp)
    app.register_blueprint(data_quality_bp)
    app.register_blueprint(monitoring_bp)
    app.register_blueprint(gis_map_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(forecasting_bp)
    app.register_blueprint(reporting_bp)
    app.register_blueprint(public_dashboard_bp)
    app.register_blueprint(public_dashboard_react_bp)
    app.register_blueprint(trends_bp)
    app.register_blueprint(comparison_bp)
    app.register_blueprint(map_insights_bp)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    return app
