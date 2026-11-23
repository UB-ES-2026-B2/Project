from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://app:app@localhost:5432/app"
    secret_key: SecretStr | None = None
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    access_token_expire_minutes: int = Field(default=30, gt=0)
    # Fotos de los anuncios (US 6.2.1). Sin MEDIA_BUCKET la subida responde 503.
    media_bucket: str | None = None
    media_base_url: str = "/media"
    # CloudFront sirve /media/* desde el bucket sin origin path: la clave empieza por media/.
    media_key_prefix: str = "media/"
    aws_region: str = "eu-west-1"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
