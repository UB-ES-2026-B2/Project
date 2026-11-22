"""disponibilidad de los anuncios y tabla de fotos (US 5.1.1)"""

import sqlalchemy as sa

from alembic import op

revision = "007_property_detail_images"
down_revision = "006_property_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.create_table(
        "property_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "property_id",
            sa.Integer(),
            sa.ForeignKey("properties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("s3_key", sa.String(length=300), nullable=True),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_property_images_property_position", "property_images", ["property_id", "position"]
    )


def downgrade() -> None:
    op.drop_index("ix_property_images_property_position", table_name="property_images")
    op.drop_table("property_images")
    op.drop_column("properties", "is_active")
