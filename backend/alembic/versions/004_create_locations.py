"""crea la tabla de ubicaciones y el indice de autocompletado (US 1.3.1)"""

import sqlalchemy as sa

from alembic import op

revision = "004_create_locations"
down_revision = "003_create_favorites"
branch_labels = None
depends_on = None

# barrios de los inmuebles de ejemplo de la migracion 001 y su codigo postal
SEED = [("L'Eixample", "08008"), ("Gràcia", "08012"), ("Sants", "08014")]
PROPERTY_COLUMNS = ("neighborhood_id", "postal_code_id")


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # unaccent no es immutable y postgres no deja usarla en un indice, por eso este envoltorio
    op.execute(
        """
        CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
        """
    )

    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.CheckConstraint(
            "type IN ('city', 'neighborhood', 'postal_code')", name="ck_locations_type"
        ),
    )
    op.create_index("ix_locations_parent_id", "locations", ["parent_id"])
    # la consulta de /suggest usa esta misma expresion
    op.execute(
        "CREATE INDEX ix_locations_name_trgm ON locations "
        "USING gin (f_unaccent(lower(name)) gin_trgm_ops)"
    )

    for column in PROPERTY_COLUMNS:
        op.add_column("properties", sa.Column(column, sa.Integer(), nullable=True))
        op.create_foreign_key(
            f"fk_properties_{column}_locations",
            "properties",
            "locations",
            [column],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(f"ix_properties_{column}", "properties", [column])

    seed_locations()


def seed_locations() -> None:
    conn = op.get_bind()
    insert_location = sa.text(
        "INSERT INTO locations (name, type, parent_id) "
        "VALUES (:name, :type, :parent_id) RETURNING id"
    )

    def add(name: str, type_: str, parent_id: int | None = None) -> int:
        params = {"name": name, "type": type_, "parent_id": parent_id}
        return conn.execute(insert_location, params).scalar_one()

    city_id = add("Barcelona", "city")
    for neighborhood, postal_code in SEED:
        neighborhood_id = add(neighborhood, "neighborhood", city_id)
        postal_code_id = add(postal_code, "postal_code", city_id)
        # los inmuebles de ejemplo guardan la ubicacion como texto tipo Sants, Barcelona
        conn.execute(
            sa.text(
                "UPDATE properties SET neighborhood_id = :neighborhood_id, "
                "postal_code_id = :postal_code_id WHERE location = :location"
            ),
            {
                "neighborhood_id": neighborhood_id,
                "postal_code_id": postal_code_id,
                "location": f"{neighborhood}, Barcelona",
            },
        )


def downgrade() -> None:
    for column in PROPERTY_COLUMNS:
        op.drop_index(f"ix_properties_{column}", table_name="properties")
        op.drop_constraint(f"fk_properties_{column}_locations", "properties", type_="foreignkey")
        op.drop_column("properties", column)
    op.drop_index("ix_locations_name_trgm", table_name="locations")
    op.drop_index("ix_locations_parent_id", table_name="locations")
    op.drop_table("locations")
    op.execute("DROP FUNCTION IF EXISTS f_unaccent(text)")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
    op.execute("DROP EXTENSION IF EXISTS unaccent")
