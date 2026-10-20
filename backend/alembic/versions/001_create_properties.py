"""create properties table

Revision ID: 001_create_properties
Revises:
"""

import sqlalchemy as sa

from alembic import op

revision = "001_create_properties"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "properties",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("location", sa.String(length=160), nullable=False),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("previous_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("bedrooms", sa.Integer(), nullable=False),
        sa.Column("bathrooms", sa.Integer(), nullable=False),
        sa.Column("area", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.bulk_insert(
        sa.table(
            "properties",
            sa.column("title", sa.String),
            sa.column("location", sa.String),
            sa.column("price", sa.Numeric),
            sa.column("previous_price", sa.Numeric),
            sa.column("bedrooms", sa.Integer),
            sa.column("bathrooms", sa.Integer),
            sa.column("area", sa.Integer),
            sa.column("image_url", sa.String),
        ),
        [
            {
                "title": "Piso luminoso con balcón",
                "location": "L'Eixample, Barcelona",
                "price": 385000,
                "previous_price": 410000,
                "bedrooms": 3,
                "bathrooms": 2,
                "area": 96,
                "image_url": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
            },
            {
                "title": "Ático reformado con terraza",
                "location": "Gràcia, Barcelona",
                "price": 520000,
                "previous_price": None,
                "bedrooms": 2,
                "bathrooms": 2,
                "area": 82,
                "image_url": "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80",
            },
            {
                "title": "Vivienda familiar exterior",
                "location": "Sants, Barcelona",
                "price": 319000,
                "previous_price": None,
                "bedrooms": 4,
                "bathrooms": 1,
                "area": 104,
                "image_url": "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("properties")
