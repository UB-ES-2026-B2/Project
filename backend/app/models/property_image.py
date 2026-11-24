from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PropertyImage(Base):
    """Foto de un anuncio. La de menor `position` es la portada (US 5.1.1 y 6.2)."""

    __tablename__ = "property_images"
    __table_args__ = (Index("ix_property_images_property_position", "property_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(500))
    # Clave del objeto en el bucket de fotos; None si la URL es externa.
    s3_key: Mapped[str | None] = mapped_column(String(300), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
