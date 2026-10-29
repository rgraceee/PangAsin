from flask import Flask, jsonify, request
from flask_login import current_user, logout_user
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
    from app.blueprints.public_api import public_api_bp
    from app.blueprints.encoder_api import encoder_api_bp
    from app.blueprints.admin_api import admin_api_bp
    from app.blueprints.analytics_api import analytics_api_bp
    from app.blueprints.forecast_api import forecast_api_bp
    from app.blueprints.reports_api import reports_api_bp
    from app.blueprints.producers_api import producers_api_bp
    from app.services.rate_limit import RateLimiter

    app.extensions["rate_limiter"] = RateLimiter()

    app.register_blueprint(monitoring_bp)
    app.register_blueprint(public_dashboard_react_bp)
    app.register_blueprint(auth_api_bp)
    app.register_blueprint(public_api_bp)
    app.register_blueprint(encoder_api_bp)
    app.register_blueprint(admin_api_bp)
    app.register_blueprint(analytics_api_bp)
    app.register_blueprint(forecast_api_bp)
    app.register_blueprint(reports_api_bp)
    app.register_blueprint(producers_api_bp)

    # WHAT: Rate-limit login attempts and admin write endpoints before the
    #       account-state guard runs.
    # WHY: A blocked or unauthenticated caller must not reach password hashing
    #      or mutation code just because the limiter is checked too late.
    @app.before_request
    def enforce_rate_limits():
        if not app.config.get("RATE_LIMIT_ENABLED", True):
            return None

        limiter = app.extensions["rate_limiter"]
        allowed = True
        retry_after = 0

        if request.path == "/api/auth/login" and request.method == "POST":
            payload = request.get_json(silent=True) or {}
            email = str(payload.get("email") or "").strip().lower()
            key = f"login:{request.remote_addr}:{email}"
            allowed, retry_after = limiter.hit(
                key,
                app.config.get("LOGIN_RATE_LIMIT", 10),
                app.config.get("LOGIN_RATE_WINDOW", 60),
            )
        elif request.path.startswith("/api/admin/") and request.method in (
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
        ):
            identity = (
                f"user:{current_user.id}"
                if current_user.is_authenticated
                else f"ip:{request.remote_addr}"
            )
            allowed, retry_after = limiter.hit(
                f"admin-write:{identity}",
                app.config.get("ADMIN_WRITE_RATE_LIMIT", 120),
                app.config.get("ADMIN_WRITE_RATE_WINDOW", 60),
            )

        if not allowed:
            return (
                jsonify({
                    "error": "Too many requests. Please wait and try again.",
                    "code": "rate_limited",
                    "retry_after": retry_after,
                }),
                429,
                {"Retry-After": str(retry_after)},
            )
        return None

    # WHAT: One central guard for account state across every blueprint.
    # WHY: Auto-created encoders must replace their temporary password before
    #      using any other API, and an account deactivated mid-session must lose
    #      access immediately (not only at the next login).
    @app.before_request
    def enforce_account_state():
        if not current_user.is_authenticated:
            return None

        if current_user.status != "active":
            logout_user()
            return jsonify({
                "error": "Account is inactive. Contact administrator."
            }), 403

        # WHAT: An encoder whose municipality was deactivated loses access even
        #       if an admin manually reactivated the account.
        # WHY: The municipality is out of scope, so its encoder must not keep
        #      submitting or reading records for it.
        if (
            current_user.role == "encoder"
            and current_user.municipality_id is not None
            and (
                current_user.municipality is None
                or current_user.municipality.status != "active"
            )
        ):
            logout_user()
            return jsonify({
                "error": "This municipality is inactive. Contact administrator."
            }), 403

        if current_user.must_change_password:
            allowed_paths = {
                "/api/auth/change-password",
                "/api/auth/logout",
                "/api/auth/me",
            }
            if request.path.startswith("/api/") and request.path not in allowed_paths:
                return jsonify({
                    "error": "Password change required before continuing.",
                    "code": "password_change_required",
                }), 403

        return None

    return app
