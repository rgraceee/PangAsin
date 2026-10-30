# WHAT: Isang maliit na email helper para sa buong app.
# WHY: Kapag papalitan ang SMTP provider (hal. Brevo), dito lang babaguhin ang
#      integration; hindi kailangang hawakan ang auth at reset logic.
from flask import current_app
from flask_mail import Message

from app.extensions import mail


def send_email(to, subject, html, text):
    """Send one email and never let a provider error crash the request."""
    try:
        message = Message(
            subject=subject,
            recipients=[to],
            html=html,
            body=text,
        )
        mail.send(message)
        return True
    except Exception:
        # WHAT: I-log ang detalye sa server pero huwag i-expose sa user.
        # WHY: SMTP errors may contain provider/account details.
        current_app.logger.exception("Failed to send email to %s", to)
        return False
