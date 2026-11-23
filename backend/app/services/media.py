"""Acceso al bucket de fotos: URLs prefirmadas de subida y borrado (US 6.2.1)."""

from functools import lru_cache
from typing import Any, Protocol

import boto3
from botocore.config import Config

UPLOAD_URL_EXPIRES = 600  # segundos


class MediaStorage(Protocol):
    def presigned_put(self, key: str, content_type: str) -> str: ...

    def delete(self, key: str) -> None: ...


class S3MediaStorage:
    def __init__(self, bucket: str, region: str) -> None:
        self.bucket = bucket
        self.client: Any = boto3.client(
            "s3", region_name=region, config=Config(signature_version="s3v4")
        )

    def presigned_put(self, key: str, content_type: str) -> str:
        return self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=UPLOAD_URL_EXPIRES,
        )

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


@lru_cache
def s3_storage(bucket: str, region: str) -> S3MediaStorage:
    return S3MediaStorage(bucket, region)
