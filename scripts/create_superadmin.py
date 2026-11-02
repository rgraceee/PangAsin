# WHAT: CLI command to create a SuperAdmin account.
# WHY: SuperAdmin accounts must be created explicitly (no self-registration)
#      and the initial password is printed once so it can be handed to the
#      person who will use it.
import argparse
import getpass
import re
import secrets
import sys
from datetime import datetime, timezone

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.services.audit import log_action


MIN_LEN = 12  # WHY: mas mahigpit para sa SuperAdmin; pwedeng gawing galing sa Configuration later
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_password(pw: str) -> str | None:
    # WHAT: basic strength check. WHY: iwas weak password sa pinakamataas na role.
    if len(pw) < MIN_LEN:
        return f"Password must be at least {MIN_LEN} characters."
    if pw.lower() == pw or pw.upper() == pw or not any(c.isdigit() for c in pw):
        return "Use upper + lower case letters and at least one number."
    return None


def generate_password() -> str:
    # WHAT: random password na pasok sa rules. WHY: secrets (hindi random) para cryptographically secure.
    while True:
        pw = secrets.token_urlsafe(16)
        if validate_password(pw) is None:
            return pw


def main() -> int:
    ap = argparse.ArgumentParser(description="Create a SuperAdmin account")
    ap.add_argument("--email", required=True)
    ap.add_argument("--name", default="System Owner")
    ap.add_argument("--generate", action="store_true", help="Generate a random password (shown once)")
    args = ap.parse_args()

    email = args.email.strip().lower()
    if not EMAIL_RE.match(email):
        print("Invalid email format.", file=sys.stderr)
        return 1

    # WHAT: kunin ang password. WHY: hindi galing sa CLI argument para di lumabas sa shell history.
    if args.generate:
        password = generate_password()
        must_change = True
    else:
        password = getpass.getpass("Password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match.", file=sys.stderr)
            return 1
        err = validate_password(password)
        if err:
            print(err, file=sys.stderr)
            return 1
        must_change = False

    app = create_app()
    with app.app_context():
        # WHAT: tanggihan kung may kapareho nang email. WHY: iwas duplicate/overwrite ng existing account.
        if User.query.filter_by(email=email).first():
            print("An account with this email already exists. Aborting.", file=sys.stderr)
            return 1

        user = User(
            name=args.name,
            email=email,
            role="superadmin",
            status="active",
            must_change_password=must_change,
            failed_login_count=0,
            locked_until=None,
        )
        user.set_password(password)
        db.session.add(user)
        db.flush()  # WHAT: para makuha ang user.id. WHY: kailangan sa audit log sa parehong transaction.

        # WHAT: audit entry. WHY: naka-log lahat ng SuperAdmin action; WALANG password sa details.
        db.add(AuditLog(
            actor_id=None,
            actor_email="cli:create_superadmin",
            action="superadmin.create",
            entity_type="user",
            entity_id=user.id,
            summary=f"SuperAdmin account created for {email}.",
            details={"role": "superadmin", "via": "cli"},
            old_value={},
            new_value={"email": email, "role": "superadmin"},
            reason="Initial SuperAdmin creation via CLI",
            ip_address=None,
            user_agent="cli",
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        ))
        db.commit()  # WHY: iisang commit; kung pumalya ang audit, hindi mabubuo ang account

    print(f"SuperAdmin created: {email}")
    if args.generate:
        print(f"Temporary password (shown ONCE, must change on first login): {password}")
    return 0


if __name__ == "__main__":
    sys.exit(main())


# WHAT: Flask CLI integration para ma-call rin bilang `flask create-superadmin`.
# WHY: backward compatibility with app/__init__.py's register_cli(app).
import click  # noqa: E402  (import at bottom para hindi masyadong maapektuhan ang standalone main())


@click.command("create-superadmin")
@click.option("--email", prompt="Email", help="SuperAdmin email address.")
@click.option("--name", prompt="Name", help="SuperAdmin full name.")
@click.option("--generate", is_flag=True, help="Generate a random password (shown once)")
def create_superadmin_cli(email, name, generate):
    """Create a SuperAdmin account with a one-time temporary password."""
    app = create_app()
    with app.app_context():
        email = (email or "").strip().lower()
        name = (name or "").strip()

        if not email or not name:
            click.echo("Email and name are required.")
            return

        if not EMAIL_RE.match(email):
            click.echo("Invalid email format.")
            return

        if User.query.filter_by(email=email).first():
            click.echo(f"An account with email {email} already exists.")
            return

        if generate:
            password = generate_password()
            must_change = True
        else:
            password = click.prompt("Password", hide_input=True, confirmation_prompt=True)
            err = validate_password(password)
            if err:
                click.echo(err)
                return
            must_change = False

        user = User(
            name=name,
            email=email,
            role="superadmin",
            status="active",
            must_change_password=must_change,
            failed_login_count=0,
            locked_until=None,
        )
        user.set_password(password)
        db.session.add(user)
        db.flush()

        db.add(AuditLog(
            actor_id=None,
            actor_email="cli:create_superadmin",
            action="superadmin.create",
            entity_type="user",
            entity_id=user.id,
            summary=f"SuperAdmin account created for {email}.",
            details={"role": "superadmin", "via": "cli"},
            old_value={},
            new_value={"email": email, "role": "superadmin"},
            reason="Initial SuperAdmin creation via CLI",
            ip_address=None,
            user_agent="cli",
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        ))
        db.commit()

        click.echo("=" * 60)
        click.echo("SuperAdmin account created.")
        click.echo(f"  Name:    {user.name}")
        click.echo(f"  Email:   {user.email}")
        click.echo(f"  Role:    {user.role}")
        click.echo("-" * 60)
        click.echo(f"Temporary password: {password}")
        click.echo(
            "Share this password once. The user must change it on first login."
        )
        click.echo("=" * 60)


def register_commands(app):
    app.cli.add_command(create_superadmin_cli)
