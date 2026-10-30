import os
from dotenv import load_dotenv

load_dotenv()

database_url = os.environ.get("DATABASE_URL")
if database_url and database_url.startswith("postgresql+psycopg://"):
    database_url = database_url.replace(
        "postgresql+psycopg://", "postgresql+psycopg2://", 1
    )
elif database_url and database_url.startswith("postgresql://"):
    database_url = database_url.replace(
        "postgresql://", "postgresql+psycopg2://", 1
    )
elif database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg2://", 1)


def _env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "you-will-never-guess"
    FLASK_ENV = os.environ.get("FLASK_ENV") or "development"
    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Supabase's connection pooler closes idle connections. Ping before
    # reusing a pooled connection and recycle them to avoid "server closed
    # the connection unexpectedly" errors.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_size": 5,
        "max_overflow": 5,
    }

    # WHAT: Lightweight in-process abuse protection.
    # WHY: Login attempts are cheap to retry and expensive to hash; admin
    #      writes are destructive. Limits are per IP (login) or per user
    #      (admin writes) inside a sliding window.
    RATE_LIMIT_ENABLED = os.environ.get("RATE_LIMIT_ENABLED", "1").lower() not in (
        "0",
        "false",
        "no",
    )
    LOGIN_RATE_LIMIT = int(os.environ.get("LOGIN_RATE_LIMIT", "10"))
    LOGIN_RATE_WINDOW = int(os.environ.get("LOGIN_RATE_WINDOW", "60"))
    ADMIN_WRITE_RATE_LIMIT = int(os.environ.get("ADMIN_WRITE_RATE_LIMIT", "120"))
    ADMIN_WRITE_RATE_WINDOW = int(os.environ.get("ADMIN_WRITE_RATE_WINDOW", "60"))
    MAX_GEOJSON_BYTES = int(os.environ.get("MAX_GEOJSON_BYTES", str(5 * 1024 * 1024)))

    # WHAT: Gmail SMTP (o anumang SMTP provider) settings mula sa .env.
    # WHY: Walang credentials na naka-hardcode; mapapalitan ang provider sa
    #      pamamagitan ng environment values lang.
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS = _env_bool("MAIL_USE_TLS", True)
    MAIL_USE_SSL = _env_bool("MAIL_USE_SSL", False)
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER") or MAIL_USERNAME

    # WHAT: Base URL ng React app para tama ang reset link sa local at deployed.
    # WHY: Hindi reliable ang request.host kapag naka-proxy ang deployment.
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5000").rstrip("/")
    PASSWORD_RESET_TOKEN_MINUTES = int(
        os.environ.get("PASSWORD_RESET_TOKEN_MINUTES", "30")
    )
    PASSWORD_RESET_RATE_LIMIT = int(
        os.environ.get("PASSWORD_RESET_RATE_LIMIT", "5")
    )
    PASSWORD_RESET_RATE_WINDOW = int(
        os.environ.get("PASSWORD_RESET_RATE_WINDOW", "3600")
    )


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
