# WHAT: Service for editable site content (Privacy, Terms, About, FAQs).
# WHY: Content lives in the database so SuperAdmin can edit it without a
#      redeploy. Missing/empty keys fall back to bundled defaults with the
#      current wording exactly, so nothing visible changes until edited.
from app.extensions import db
from app.models.site_content import SiteContent
from app.services.audit import log_action
from flask import request
from flask_login import current_user
from datetime import datetime
import re

CONTENT_KEYS = ("privacy", "terms", "about", "faq_admin", "faq_encoder", "faq_public")

# Dangerous patterns stripped from user-editable content to prevent XSS.
_SCRIPT_RE = re.compile(r"<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>", re.IGNORECASE | re.DOTALL)
_EVENT_HANDLER_RE = re.compile(r"\bon(?:click|load|error|mouseover|mouseout|submit|change|focus|blur|keydown|keyup|keypress|abort|resize|scroll|unload|dblclick|mousedown|mouseup|mousemove|mouseenter|mouseleave|select|reset|abort|canplay|canplaythrough|durationchange|emptied|ended|loadeddata|loadedmetadata|loadstart|pause|play|playing|progress|ratechange|seeked|seeking|stalled|suspend|timeupdate|volumechange|waiting|toggle|wheel|pointerdown|pointerup|pointermove|pointerenter|pointerleave|pointerover|pointerout|cancel|invalid|copy|cut|paste|compositionstart|compositionupdate|compositionend|drag|dragend|dragenter|dragleave|dragover|dragstart|drop)\s*=", re.IGNORECASE)
_JAVASCRIPT_URL_RE = re.compile(r"\bjavascript\s*:", re.IGNORECASE)
_DATA_URI_RE = re.compile(r"\bdata\s*:\s*(?:text/html|application/javascript|image/svg\+xml)", re.IGNORECASE)


def _sanitize_text(value):
    """Strip script tags, inline event handlers, javascript: URLs and data: URIs from a string."""
    if not isinstance(value, str):
        return value
    result = _SCRIPT_RE.sub("", value)
    result = _EVENT_HANDLER_RE.sub("", result)
    result = _JAVASCRIPT_URL_RE.sub("", result)
    result = _DATA_URI_RE.sub("", result)
    return result


def _sanitize_structure(obj):
    """Recursively sanitize all strings in a dict/list structure."""
    if isinstance(obj, str):
        return _sanitize_text(obj)
    if isinstance(obj, list):
        return [_sanitize_structure(item) for item in obj]
    if isinstance(obj, dict):
        return {k: _sanitize_structure(v) for k, v in obj.items()}
    return obj

# Bundled defaults reproduce the current public wording exactly.
# Privacy / Terms: sections of title + paragraphs/bullets, plus last_updated.
# About: name, version, partners, credit, note.
# FAQs: list of {category, items:[{q, a}]}.
DEFAULTS = {
    "privacy": {
        "title": "Privacy Policy",
        "last_updated": "30 October 2026",
        "sections": [
            {
                "title": "1. What data we collect",
                "paragraphs": [
                    "PangAsin is the salt production monitoring system of the ASIN Center, Pangasinan State University. This policy explains what personal data the system collects, why it is collected, who can see it, and the choices you have. It is based on the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and the issuances of the National Privacy Commission (NPC)."
                ],
                "bullets": [
                    "Account data for administrators and encoders: name, email address, role, account status, and the municipality assigned to an encoder.",
                    "Salt farmer records: name, age, sex, barangay, and address as recorded by the encoder.",
                    "Production and environment reports: salt bed details, production volume, production method, and related field notes submitted by encoders.",
                    "Activity logs: sign-in events, account changes, data approvals and rejections, deletions, and other auditable actions.",
                ],
            },
            {
                "title": "2. Why we collect it",
                "paragraphs": [
                    "We process this data to perform our public mandate and legitimate functions, and with the consent of individuals where the law requires it."
                ],
                "bullets": [
                    "To register and maintain the salt farmer master list.",
                    "To record, validate, and aggregate salt production reports.",
                    "To generate reports, forecasts, and decision-support views.",
                    "To manage accounts and keep the system secure.",
                    "To comply with audit and reporting requirements of the ASIN Center.",
                ],
            },
            {
                "title": "3. Who can see it",
                "paragraphs": [
                    "Access is limited by role. We do not sell personal data and do not share it with third parties except when required by law or by a competent authority."
                ],
                "bullets": [
                    "The public sees aggregated, municipality-level production figures and charts. Names and individual records are not shown.",
                    "Encoders see the records of the municipality assigned to them.",
                    "Administrators see the records across municipalities so they can validate submissions and prepare reports.",
                ],
            },
            {
                "title": "4. How we protect it",
                "paragraphs": [
                    "No system is perfectly secure. If we learn of a breach that affects personal data, we will notify the NPC and affected individuals as required by law."
                ],
                "bullets": [
                    "Passwords are stored as one-way hashes, never as plain text.",
                    "Sign-in is required before any non-public page can be opened.",
                    "Role-based access limits each account to its assigned functions.",
                    "Key actions are written to an audit log for review.",
                    "Traffic is served over HTTPS when the system is deployed.",
                ],
            },
            {
                "title": "5. How long we keep it",
                "paragraphs": [
                    "Records are kept for as long as they are needed for the salt industry monitoring, reporting, and audit purposes of the ASIN Center. When data is no longer needed, it is deleted or anonymized. Audit logs are retained longer because they are needed to investigate incidents and account for changes."
                ],
                "bullets": [],
            },
            {
                "title": "6. Your rights",
                "paragraphs": [
                    "Under the Data Privacy Act, you have the right to:",
                    "To exercise these rights, contact us at pang.asin26@gmail.com. You may also reach the NPC through privacy.gov.ph.",
                ],
                "bullets": [
                    "be informed about how your data is collected and used;",
                    "access the personal data we hold about you;",
                    "ask us to correct inaccurate or incomplete data;",
                    "ask us to block or erase data that is no longer necessary or is being used unlawfully;",
                    "object to processing in the cases allowed by law; and",
                    "file a complaint with the National Privacy Commission.",
                ],
            },
            {
                "title": "7. Your responsibilities",
                "paragraphs": [],
                "bullets": [
                    "Provide accurate and complete information in the records you submit.",
                    "Use the system only for authorized salt industry monitoring work.",
                    "Never share your account or password with another person.",
                    "Report suspected unauthorized access or data loss to the ASIN Center immediately.",
                ],
            },
            {
                "title": "8. Contact",
                "paragraphs": [
                    "For privacy questions or requests, contact the PangAsin team at pang.asin26@gmail.com. You may also visit the ASIN Center, Pangasinan State University, Binmaley, Pangasinan."
                ],
                "bullets": [],
            },
        ],
    },
    "terms": {
        "title": "Terms & Conditions",
        "last_updated": "30 October 2026",
        "sections": [
            {
                "title": "1. Acceptance of terms",
                "paragraphs": [
                    "By accessing or using PangAsin, you agree to these terms and conditions. If you do not agree, you may not use the system."
                ],
                "bullets": [],
            },
            {
                "title": "2. Use of the system",
                "paragraphs": [
                    "The system is for authorized salt industry monitoring work by the ASIN Center, administrators, and municipal encoders."
                ],
                "bullets": [
                    "Provide accurate and complete information in the records you submit.",
                    "Never share your account or password with another person.",
                    "Report suspected unauthorized access or data loss to the ASIN Center immediately.",
                ],
            },
            {
                "title": "3. Data and content",
                "paragraphs": [
                    "The public dashboard shows only summarized, municipality-level production figures. Names and individual records are not shown."
                ],
                "bullets": [],
            },
            {
                "title": "4. Limitation of liability",
                "paragraphs": [
                    "Forecasts are estimates based on past production records and are not a guarantee of future output. The ASIN Center is not liable for decisions made using the system."
                ],
                "bullets": [],
            },
            {
                "title": "5. Contact",
                "paragraphs": [
                    "For questions, contact the PangAsin team at pang.asin26@gmail.com."
                ],
                "bullets": [],
            },
        ],
    },
    "about": {
        "name": "PangAsin",
        "version": None,  # filled from package.json at read time by the frontend/API
        "partners": "DOST NICER ASIN Center · BFAR Regional Field Office 1",
        "credit": "PangAsin, BS Information Technology, Pangasinan State University - Urdaneta City Campus",
        "note": "Salt production monitoring system for the province of Pangasinan.",
    },
    "faq_public": [
        {
            "category": "About PangAsin",
            "items": [
                {
                    "q": "What is PangAsin?",
                    "a": "PangAsin is a salt production monitoring and forecasting dashboard for the salt-producing municipalities of Pangasinan. It supports planning and data-driven decisions for the local salt industry.",
                },
                {
                    "q": "Who can use it?",
                    "a": "Anyone can view the public dashboard without signing in. ASIN Center administrators and municipal encoders sign in to manage records, reports, and dashboards.",
                },
                {
                    "q": "Does it show personal information?",
                    "a": "No. The public dashboard shows only summarized, municipality-level production figures. No personal data is exposed.",
                },
            ],
        },
        {
            "category": "Understanding the dashboard",
            "items": [
                {
                    "q": "What do the cards mean?",
                    "a": "Each card summarizes one measure — national salt demand, supply coverage, import dependence, or total municipality production.",
                },
                {
                    "q": "What unit is used?",
                    "a": "Production is measured in metric tons (MT). The public dashboard rounds values for readability.",
                },
                {
                    "q": "How do I read the map?",
                    "a": "Greener means higher production. Click a municipality on the map to see its production, change, salt beds, dominant method, and male/female producer count.",
                },
                {
                    "q": "What is a forecast?",
                    "a": "A forecast is an estimate based on past production records. It is not a guarantee of future output.",
                },
                {
                    "q": "Why \"—\" or no data?",
                    "a": "A dash means no records are available yet for that municipality or field.",
                },
            ],
        },
        {
            "category": "Accounts",
            "items": [
                {
                    "q": "Do I need an account to view?",
                    "a": "No. The public dashboard is open to everyone. An account is only needed to sign in as an administrator or encoder.",
                },
                {
                    "q": "How do I get one?",
                    "a": "Accounts are created by the ASIN Center administrator. Contact them if you need access as an encoder or administrator.",
                },
                {
                    "q": "Forgot password?",
                    "a": "On the sign-in page, select \"Forgot password\" and enter your email. You will receive a reset link. If none arrives, contact your administrator or the ASIN Center.",
                },
            ],
        },
        {
            "category": "Feedback",
            "items": [
                {
                    "q": "How do I report a data error or problem?",
                    "a": "Email the ASIN Center via the contact card with your name, municipality, the period in question, and a short description of the problem. Screenshots help us respond faster.",
                },
            ],
        },
    ],
    "faq_admin": [
        {
            "category": "Validation Queue",
            "items": [
                {
                    "q": "How do I review submitted records?",
                    "a": "Open Validation Queue from the sidebar and filter by municipality or status. Open a report to check its entries, then select Approve to include it in production totals, or Reject to return it for correction — a comment explaining what to fix is required when rejecting.",
                },
            ],
        },
        {
            "category": "Generating reports",
            "items": [
                {
                    "q": "How do I generate and download a report?",
                    "a": "Open Generate Reports from the sidebar, choose the content sections, set the scope (province or municipality) and time period, select PDF or Word, then select Generate. Preview the report before downloading.",
                },
            ],
        },
    ],
    "faq_encoder": [
        {
            "category": "Records",
            "items": [
                {
                    "q": "How do I add records?",
                    "a": "Production records: open Production Records from the sidebar, choose New report, pick the barangay and production month, enter each salt bed's volume and method, then submit — it goes to the validation queue.",
                },
                {
                    "q": "What happens after I submit, and how do I fix a returned record?",
                    "a": "After you submit, your report goes to the validation queue and is marked pending. An administrator reviews it — if approved, it's included in production totals and dashboards; if returned, a reviewer comment explains what to fix. Correct the entries and submit again.",
                },
            ],
        },
    ],
}


def _default_for(key):
    return dict(DEFAULTS.get(key, {}))


def get_content(key):
    """Return content for a key, falling back to bundled defaults.

    Never returns blank: on any failure the default is returned.
    """
    try:
        row = SiteContent.query.get(key)
    except Exception:
        row = None
    if row and row.data:
        data = row.data
        # Ensure every expected section key exists; merge missing from defaults.
        default = _default_for(key)
        if isinstance(data, dict) and isinstance(default, dict):
            for k, v in default.items():
                data.setdefault(k, v)
        return data
    return _default_for(key)


def set_content(key, data, actor):
    """Validate and persist content for a key. Writes an audit row."""
    if key not in CONTENT_KEYS:
        return None, "Unknown content key."
    if not isinstance(data, dict):
        return None, "Content must be a JSON object."

    # Sanitize all string values to prevent XSS through edited content.
    data = _sanitize_structure(data)

    # Server validation: required titles for privacy/terms/about; max lengths.
    if key in ("privacy", "terms"):
        if not data.get("title"):
            return None, "Title is required."
    if key == "about":
        if not data.get("name"):
            return None, "App name is required."

    # Auto-set last_updated for privacy/terms so it always reflects the save time.
    if key in ("privacy", "terms"):
        data["last_updated"] = datetime.utcnow().strftime("%d %B %Y")

    row = SiteContent.query.get(key)
    if not row:
        row = SiteContent(key=key)
        db.session.add(row)
    before = row.data
    row.data = data
    row.updated_by = getattr(actor, "id", None) if actor else None
    row.updated_at = datetime.utcnow()

    log_action(
        "superadmin.content.update",
        "site_content",
        key,
        actor=current_user,
        summary=f"{current_user.email if current_user.is_authenticated else actor} updated {key} content.",
        details={"key": key, "before": before, "after": data},
    )
    return row, None


def reset_content(key, actor):
    """Reset content for a key to its bundled default and persist. Audited."""
    if key not in CONTENT_KEYS:
        return None, "Unknown content key."

    default = _default_for(key)
    # Sanitize defaults too (defensive).
    default = _sanitize_structure(default)
    if key in ("privacy", "terms"):
        default["last_updated"] = datetime.utcnow().strftime("%d %B %Y")

    row = SiteContent.query.get(key)
    before = row.data if row and row.data else None
    if not row:
        row = SiteContent(key=key)
        db.session.add(row)
    row.data = default
    row.updated_by = getattr(actor, "id", None) if actor else None
    row.updated_at = datetime.utcnow()

    log_action(
        "superadmin.content.reset",
        "site_content",
        key,
        actor=current_user,
        summary=f"{current_user.email if current_user.is_authenticated else actor} reset {key} content to default.",
        details={"key": key, "before": before, "after": default},
    )
    return row, None
