# WHAT: CLI command to create a SuperAdmin account.
# WHY: SuperAdmin accounts must be created explicitly (no self-registration)
#      and the initial password is printed once so it can be handed to the
#      person who will use it.
import click
from flask import current_app

from app import create_app
from app.extensions import db
from app.models.user import User
from app.services.audit import log_action


@click.command("create-superadmin")
@click.option("--email", prompt="Email", help="SuperAdmin email address.")
@click.option("--name", prompt="Name", help="SuperAdmin full name.")
def create_superadmin(email, name):
    """Create a SuperAdmin account with a one-time temporary password."""
    app = create_app()
    with app.app_context():
        email = (email or "").strip().lower()
        name = (name or "").strip()

        if not email or not name:
            click.echo("Email and name are required.")
            return

        if User.query.filter_by(email=email).first():
            click.echo(f"An account with email {email} already exists.")
            return

        import secrets

        raw_password = secrets.token_urlsafe(16)

        user = User(
            name=name,
            email=email,
            role="superadmin",
            status="active",
            must_change_password=True,
        )
        user.set_password(raw_password)
        db.session.add(user)
        db.session.commit()

        log_action(
            "superadmin.user.create_cli",
            "user",
            user.id,
            summary=f"Created SuperAdmin account {user.email} via CLI.",
            details={"email": user.email, "role": user.role},
        )
        db.session.commit()

        click.echo("=" * 60)
        click.echo("SuperAdmin account created.")
        click.echo(f"  Name:    {user.name}")
        click.echo(f"  Email:   {user.email}")
        click.echo(f"  Role:    {user.role}")
        click.echo("-" * 60)
        click.echo(f"Temporary password: {raw_password}")
        click.echo(
            "Share this password once. The user must change it on first login."
        )
        click.echo("=" * 60)


def register_commands(app):
    app.cli.add_command(create_superadmin)
