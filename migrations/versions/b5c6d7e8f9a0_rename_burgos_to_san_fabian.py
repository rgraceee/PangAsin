"""rename municipality Burgos to San Fabian

Revision ID: b5c6d7e8f9a0
Revises: a1b2c3d4e5f6
Create Date: 2026-09-03 14:00:00.000000

Renames the seeded municipality "Burgos" to the actual coastal salt
municipality "San Fabian", renames its salt barangays to San Fabian's
coastal barangays, and updates the linked encoder account email/name.
municipality_id (5) and all FK-linked records are preserved.

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b5c6d7e8f9a0'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

# San Fabian::old_barangay -> San Fabian::new_barangay
BARANGAY_RENAMES = {
    "Pilar": "Tiblong",
    "Santiago": "Bolasi",
    "Bato": "Longos",
}


def upgrade():
    conn = op.get_bind()
    muni_id = conn.execute(
        sa.text("SELECT id FROM municipalities WHERE name = :n"),
        {"n": "Burgos"},
    ).scalar()
    if muni_id is None:
        print("[b5c6d7e8f9a0] No municipality named 'Burgos' found; nothing to rename.")
        return

    conn.execute(
        sa.text("UPDATE municipalities SET name = :new WHERE id = :mid"),
        {"new": "San Fabian", "mid": muni_id},
    )

    for old, new in BARANGAY_RENAMES.items():
        conn.execute(
            sa.text(
                "UPDATE barangays SET name = :new "
                "WHERE municipality_id = :mid AND name = :old"
            ),
            {"new": new, "mid": muni_id, "old": old},
        )

    conn.execute(
        sa.text(
            "UPDATE users SET email = 'san.fabian.encoder@pangasin.gov.ph', "
            "name = 'Encoder - San Fabian' "
            "WHERE municipality_id = :mid AND role = 'encoder'"
        ),
        {"mid": muni_id},
    )


def downgrade():
    conn = op.get_bind()
    muni_id = conn.execute(
        sa.text("SELECT id FROM municipalities WHERE name = :n"),
        {"n": "San Fabian"},
    ).scalar()
    if muni_id is None:
        return

    conn.execute(
        sa.text("UPDATE municipalities SET name = 'Burgos' WHERE id = :mid"),
        {"mid": muni_id},
    )

    for old, new in BARANGAY_RENAMES.items():
        conn.execute(
            sa.text(
                "UPDATE barangays SET name = :old "
                "WHERE municipality_id = :mid AND name = :new"
            ),
            {"old": old, "mid": muni_id, "new": new},
        )

    conn.execute(
        sa.text(
            "UPDATE users SET email = 'burgos.encoder@pangasin.gov.ph', "
            "name = 'Encoder - Burgos' "
            "WHERE municipality_id = :mid AND role = 'encoder'"
        ),
        {"mid": muni_id},
    )
