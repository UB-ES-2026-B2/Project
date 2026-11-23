"""añade los datos de operación, tipología y descripción de los anuncios"""

import sqlalchemy as sa

from alembic import op

revision = "006_property_details"
down_revision = "005_add_property_owner"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("properties", sa.Column("operation_type", sa.String(length=10), nullable=True))
    op.add_column("properties", sa.Column("property_type", sa.String(length=20), nullable=True))
    op.add_column("properties", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("properties", sa.Column("address", sa.String(length=160), nullable=True))
    op.create_check_constraint(
        "ck_properties_operation_type",
        "properties",
        "operation_type IS NULL OR operation_type IN ('sale', 'rent')",
    )
    op.create_check_constraint(
        "ck_properties_property_type",
        "properties",
        "property_type IS NULL OR property_type IN "
        "('flat', 'house', 'local', 'office', 'garage', 'storage')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_properties_property_type", "properties", type_="check")
    op.drop_constraint("ck_properties_operation_type", "properties", type_="check")
    op.drop_column("properties", "address")
    op.drop_column("properties", "description")
    op.drop_column("properties", "property_type")
    op.drop_column("properties", "operation_type")
