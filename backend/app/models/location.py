from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Location(Base):
    """Ciudad, barrio o código postal del autocompletado del buscador (US 1.3.1)."""

    __tablename__ = "locations"
    __table_args__ = (
        CheckConstraint(
            "type IN ('city', 'neighborhood', 'postal_code')", name="ck_locations_type"
        ),
    )
    # el indice gin de name va solo en la migracion 004 porque sqlite no lo soporta

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(20))
    # barrios y codigos postales cuelgan de su ciudad
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"), nullable=True, index=True
    )
