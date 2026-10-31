"""Single source of truth for production record and submission statuses.

The only statuses the system uses are Pending, Approved and Rejected.
Draft and Returned were removed from the data model, API validation, filters,
badges and every other UI surface.

Keep this file in sync with frontend/src/constants/labels.js.
"""

# The only statuses accepted by the API and shown in every UI control.
ALLOWED_STATUSES = ("pending", "approved", "rejected")

STATUS_LABELS = {
    "pending": "Pending",
    "approved": "Approved",
    "rejected": "Rejected",
}

STATUS_TONES = {
    "pending": "warning",
    "approved": "good",
    "rejected": "danger",
}
