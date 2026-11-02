# WHAT: Mag-set ng bagong password para sa isang SuperAdmin, ikaw ang magta-type.
# WHY: Hindi na mababawi ang lumang password (hash lang ang naka-store).
import argparse
import getpass
import sys

from app import create_app
from app.extensions import db
from app.models.user import User

MIN_LEN = 12


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    args = ap.parse_args()

    app = create_app()
    with app.app_context():
        # WHAT: hanapin ang account at siguraduhing superadmin. WHY: iwas aksidenteng mag-reset ng ibang role.
        user = User.query.filter_by(email=args.email.strip().lower()).first()
        if user is None or user.role != "superadmin":
            print("No SuperAdmin with that email.", file=sys.stderr)
            return 1

        pw = getpass.getpass("New password: ")
        if pw != getpass.getpass("Confirm password: "):
            print("Passwords do not match.", file=sys.stderr)
            return 1
        if len(pw) < MIN_LEN or pw.lower() == pw or pw.upper() == pw or not any(c.isdigit() for c in pw):
            print(f"Need {MIN_LEN}+ chars with upper, lower, and a number.", file=sys.stderr)
            return 1

        # WHAT: gamitin ang parehong hasher ng login. WHY: para tumugma sa login check.
        user.set_password(pw)  # ADJUST kung iba ang pangalan ng method sa User model
        user.failed_attempts = 0
        user.locked_until = None
        # user.is_active = True
        db.session.commit()
        print(f"Password updated for {user.email}.")
        return 0


if __name__ == "__main__":
    sys.exit(main())