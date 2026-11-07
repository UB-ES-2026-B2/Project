"""crea la tabla de favoritos (US 1.2.1)"""

import sqlalchemy as sa

from alembic import op

revision = "003_create_favorites"
down_revision = "002_create_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "favorites",
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "property_id",
            sa.Integer(),
            sa.ForeignKey("properties.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_favorites_property_id", "favorites", ["property_id"])


def downgrade() -> None:
    op.drop_index("ix_favorites_property_id", table_name="favorites")
    op.drop_table("favorites")
