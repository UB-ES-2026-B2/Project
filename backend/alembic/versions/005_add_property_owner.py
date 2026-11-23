"""añade el propietario de los anuncios (US 6.1.1)"""

import sqlalchemy as sa

from alembic import op

revision = "005_add_property_owner"
down_revision = "004_create_locations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("properties", sa.Column("owner_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_properties_owner_id_users",
        "properties",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_properties_owner_id", "properties", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_properties_owner_id", table_name="properties")
    op.drop_constraint("fk_properties_owner_id_users", "properties", type_="foreignkey")
    op.drop_column("properties", "owner_id")
