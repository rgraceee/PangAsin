# WHAT: Typed, validated runtime settings read by the app with current behavior
#       as defaults. SuperAdmin can change them; every write is audited.
# WHY: Centralises knobs so the app behaves identically until a SuperAdmin
#      edits a setting, and every change is recorded.
from app.extensions import db
from app.models.system_setting import SystemSetting
from app.services.audit import log_action
from flask_login import current_user
from datetime import datetime

# code -> {type, default, min, max, required, label}
SETTINGS_REGISTRY = {
    "min_password_length": {"type": "int", "default": 6, "min": 4, "max": 128},
    "lockout_attempts": {"type": "int", "default": 5, "min": 1, "max": 100},
    "lockout_minutes": {"type": "int", "default": 15, "min": 1, "max": 10080},
    "default_password_length": {"type": "int", "default": 16, "min": 8, "max": 128},
    "forgot_password_validity_minutes": {"type": "int", "default": 30, "min": 5, "max": 525600},
    "forgot_password_request_limit_per_hour": {"type": "int", "default": 5, "min": 1, "max": 10000},
    "forgot_password_email_subject": {"type": "string", "default": "PangAsin password reset", "min": 1, "max": 200},
    "forgot_password_email_message": {"type": "string", "default": "You requested a password reset for your PangAsin account. Use the reset link below to set a new password. If you did not request this, you can ignore this email.", "min": 1, "max": 4000},
}

SETTING_CODES = tuple(SETTINGS_REGISTRY.keys())


def _coerce(value, spec):
    t = spec["type"]
    if t == "int":
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
    return value


def _validate(code, value):
    spec = SETTINGS_REGISTRY.get(code)
    if not spec:
        return None, "Unknown setting key."
    coerced = _coerce(value, spec)
    if spec["type"] == "int" and coerced is None:
        return None, f"{code} must be an integer."
    if "min" in spec and coerced is not None and coerced < spec["min"]:
        return None, f"{code} must be at least {spec['min']}."
    if "max" in spec and coerced is not None and coerced > spec["max"]:
        return None, f"{code} must be at most {spec['max']}."
    if spec["type"] == "string":
        if not isinstance(value, str) or not value.strip():
            return None, f"{code} is required."
        if len(value) > spec["max"]:
            return None, f"{code} is too long (max {spec['max']} chars)."
        coerced = value
    return coerced, None


def get_setting(code, default=None):
    """Return the setting value, falling back to the registry default.

    Never returns blank on failure.
    """
    spec = SETTINGS_REGISTRY.get(code)
    fallback = default if default is not None else (spec.get("default") if spec else None)
    try:
        row = SystemSetting.query.get(code)
    except Exception:
        row = None
    if row and row.value is not None:
        return _coerce(row.value, spec) if spec else row.value
    return fallback


def get_all_settings():
    """Return every registered setting with its current (or default) value."""
    out = {}
    for code, spec in SETTINGS_REGISTRY.items():
        out[code] = {"type": spec["type"], "value": get_setting(code), "default": spec.get("default")}
    return out


def set_setting(code, value, actor):
    """Validate and persist a setting. Writes an audit row."""
    spec = SETTINGS_REGISTRY.get(code)
    if not spec:
        return None, "Unknown setting key."
    coerced, err = _validate(code, value)
    if err:
        return None, err

    row = SystemSetting.query.get(code)
    before = None
    if row:
        before = row.value
    if not row:
        row = SystemSetting(key=code, type=spec["type"])
        db.session.add(row)
    row.value = coerced
    row.type = spec["type"]
    row.updated_at = datetime.utcnow()

    log_action(
        "superadmin.setting.update",
        "system_setting",
        code,
        actor=current_user,
        summary=f"{current_user.email if current_user.is_authenticated else actor} updated setting {code}.",
        details={"key": code, "before": before, "after": coerced},
    )
    return row, None
