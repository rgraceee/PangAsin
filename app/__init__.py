from flask import Flask, jsonify, request, session
from flask_login import current_user, logout_user
from app.config import Config
from app.extensions import db, migrate, login_manager, mail


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)
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
        elif (
            request.path == "/api/auth/password-reset-request"
            and request.method == "POST"
        ):
            # WHAT: Limitahan ang reset requests per email at per IP.
            # WHY: Public endpoint ito; kailangan protektado ang inbox ng user
            #      at ang server mula sa paulit-ulit na email sends.
            payload = request.get_json(silent=True) or {}
            email = str(payload.get("email") or "").strip().lower()
            limit = app.config.get("PASSWORD_RESET_RATE_LIMIT", 5)
            window = app.config.get("PASSWORD_RESET_RATE_WINDOW", 3600)
            email_allowed, email_retry = limiter.hit(
                f"password-reset:email:{email}", limit, window
            )
            ip_allowed, ip_retry = limiter.hit(
                f"password-reset:ip:{request.remote_addr}", limit, window
            )
            allowed = email_allowed and ip_allowed
            retry_after = max(email_retry, ip_retry)
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
        # WHAT: Public ang password-reset endpoints kahit may lumang session.
        # WHY: Kapag na-invalidate na ang session, kailangan pa ring makapasok
        #      sa reset link at makapag-set ng bagong password.
        if request.path.startswith("/api/auth/password-reset"):
            return None

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

        # WHAT: Ihambing ang session marker sa account version.
        # WHY: Kapag nag-reset ng password, ini-increment ang version para
        #      mawalan ng bisa ang lahat ng existing signed-in sessions.
        if session.get("auth_version") != current_user.session_version:
            logout_user()
            return jsonify({
                "error": "Your session has expired. Please sign in again.",
                "code": "session_expired",
            }), 401

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
