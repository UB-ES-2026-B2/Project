"""US 6.2.1: fotos del anuncio con URLs prefirmadas de S3, orden, portada y borrado."""

import pytest
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.routes.property_images import get_media_storage
from app.core.config import Settings, get_settings
from app.main import app
from app.models.property import Property
from app.models.property_image import PropertyImage
from app.services.media import S3MediaStorage

# Reutiliza los fixtures PostgreSQL con savepoint y la configuración de autenticación.
from tests.test_auth import auth_settings, client, db  # noqa: F401
from tests.test_favorites import auth, make_user


class FakeStorage:
    def __init__(self) -> None:
        self.signed: list[tuple[str, str]] = []
        self.deleted: list[str] = []
        self.fail = False

    def presigned_put(self, key: str, content_type: str) -> str:
        if self.fail:
            raise ClientError({"Error": {"Code": "AccessDenied"}}, "PutObject")
        self.signed.append((key, content_type))
        return f"https://bucket.s3.amazonaws.com/{key}?X-Amz-Signature=x"

    def delete(self, key: str) -> None:
        if self.fail:
            raise ClientError({"Error": {"Code": "AccessDenied"}}, "DeleteObject")
        self.deleted.append(key)


@pytest.fixture
def storage() -> FakeStorage:
    fake = FakeStorage()
    app.dependency_overrides[get_media_storage] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_media_storage, None)


@pytest.fixture
def owner(db: Session):  # noqa: F811
    return make_user(db, "anunciante@example.com")


@pytest.fixture
def prop(db: Session, owner) -> Property:  # noqa: F811
    property_ = Property(
        title="Piso con fotos",
        location="Barcelona",
        price=200000,
        bedrooms=2,
        bathrooms=1,
        area=70,
        owner_id=owner.id,
    )
    db.add(property_)
    db.flush()
    return property_


def url(prop: Property, suffix: str = "") -> str:
    return f"/api/v1/properties/{prop.id}/images{suffix}"


def upload(client: TestClient, prop: Property, owner, **extra):  # noqa: F811
    payload = {"filename": "salon.jpg", "content_type": "image/jpeg", "size": 1024} | extra
    return client.post(url(prop, "/upload-url"), json=payload, headers=auth(owner))


def test_upload_url_reserves_the_photo_and_signs_the_put(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
) -> None:
    response = upload(client, prop, owner, content_type="image/webp")

    assert response.status_code == 201
    body = response.json()
    key, content_type = storage.signed[0]
    assert key.startswith(f"media/properties/{prop.id}/") and key.endswith(".webp")
    assert content_type == "image/webp"
    assert body["headers"] == {"Content-Type": "image/webp"}
    assert body["upload_url"].startswith("https://bucket.s3.amazonaws.com/media/properties/")
    assert body["image"]["url"] == "/" + key
    assert body["image"]["position"] == 0
    db.refresh(prop)
    assert prop.image_url == body["image"]["url"]


def test_next_uploads_go_to_the_end_and_cover_stays(
    client: TestClient,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
) -> None:
    first = upload(client, prop, owner).json()["image"]
    second = upload(client, prop, owner).json()["image"]

    assert (first["position"], second["position"]) == (0, 1)
    detail = client.get(f"/api/v1/properties/{prop.id}").json()
    assert detail["image_url"] == first["url"]
    assert detail["images"] == [first["url"], second["url"]]


@pytest.mark.parametrize(
    "extra",
    [{"content_type": "image/gif"}, {"content_type": "application/pdf"}, {"size": 6 * 1024 * 1024}],
    ids=["gif", "pdf", "too-big"],
)
def test_rejects_wrong_type_or_size(
    client: TestClient,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
    extra: dict,
) -> None:
    assert upload(client, prop, owner, **extra).status_code == 422
    assert storage.signed == []


def test_only_the_owner_can_manage_photos(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
) -> None:
    stranger = make_user(db, "otra@example.com")
    image = upload(client, prop, owner).json()["image"]

    assert upload(client, prop, stranger).status_code == 403
    assert (
        client.put(url(prop, "/reorder"), json={"image_ids": [image["id"]]}, headers=auth(stranger))
    ).status_code == 403
    assert client.delete(url(prop, f"/{image['id']}"), headers=auth(stranger)).status_code == 403
    assert client.post(url(prop, "/upload-url"), json={}).status_code == 401


def test_unknown_property_is_404(client: TestClient, storage: FakeStorage, owner) -> None:  # noqa: F811
    response = client.post(
        "/api/v1/properties/999999999/images/upload-url",
        json={"filename": "a.jpg", "content_type": "image/jpeg", "size": 10},
        headers=auth(owner),
    )
    assert response.status_code == 404


def test_reorder_with_cover_moves_it_first_and_updates_the_card(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
) -> None:
    a, b, c = (upload(client, prop, owner).json()["image"] for _ in range(3))

    response = client.put(
        url(prop, "/reorder"),
        json={"image_ids": [a["id"], b["id"], c["id"]], "cover_id": c["id"]},
        headers=auth(owner),
    )

    assert response.status_code == 200
    assert [i["id"] for i in response.json()] == [c["id"], a["id"], b["id"]]
    db.refresh(prop)
    assert prop.image_url == c["url"]
    assert client.get(url(prop)).json()[0]["id"] == c["id"]


@pytest.mark.parametrize("which", ["missing", "duplicated", "foreign"])
def test_reorder_needs_each_photo_exactly_once(
    client: TestClient,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
    which: str,
) -> None:
    a, b = (upload(client, prop, owner).json()["image"] for _ in range(2))
    ids = {"missing": [a["id"]], "duplicated": [a["id"], a["id"], b["id"]]}.get(
        which, [a["id"], b["id"], 999999]
    )

    response = client.put(url(prop, "/reorder"), json={"image_ids": ids}, headers=auth(owner))

    assert response.status_code == 422


def test_delete_removes_the_object_and_compacts_positions(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
) -> None:
    a, b, c = (upload(client, prop, owner).json()["image"] for _ in range(3))
    key_a = a["url"].lstrip("/")

    assert client.delete(url(prop, f"/{a['id']}"), headers=auth(owner)).status_code == 204

    assert storage.deleted == [key_a]
    remaining = client.get(url(prop)).json()
    assert [(i["id"], i["position"]) for i in remaining] == [(b["id"], 0), (c["id"], 1)]
    db.refresh(prop)
    assert prop.image_url == b["url"]
    assert client.delete(url(prop, f"/{a['id']}"), headers=auth(owner)).status_code == 404


def test_deleting_the_last_photo_clears_the_card_image(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
) -> None:
    image = upload(client, prop, owner).json()["image"]
    storage.fail = True  # un fallo de S3 al borrar no impide quitar la foto

    assert client.delete(url(prop, f"/{image['id']}"), headers=auth(owner)).status_code == 204

    db.refresh(prop)
    assert prop.image_url is None


def test_signing_error_is_503_and_reserves_nothing(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
) -> None:
    storage.fail = True

    assert upload(client, prop, owner).status_code == 503
    assert db.query(PropertyImage).filter_by(property_id=prop.id).count() == 0


def test_limit_of_twenty_photos(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    storage: FakeStorage,
    owner,
    prop: Property,
) -> None:
    db.add_all(
        PropertyImage(property_id=prop.id, url=f"/media/x{i}.jpg", position=i) for i in range(20)
    )
    db.flush()
    db.refresh(prop)

    assert upload(client, prop, owner).status_code == 409


def test_without_bucket_upload_is_503(
    client: TestClient,  # noqa: F811
    owner,
    prop: Property,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("MEDIA_BUCKET", raising=False)
    get_settings.cache_clear()

    response = upload(client, prop, owner)

    assert response.status_code == 503
    assert response.json() == {"detail": "La subida de fotos no está configurada"}


def test_get_media_storage_uses_the_configured_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")
    storage = get_media_storage(Settings(media_bucket="bucket-de-prueba"))

    assert isinstance(storage, S3MediaStorage)
    signed = storage.presigned_put("media/properties/1/a.jpg", "image/jpeg")
    assert "bucket-de-prueba" in signed and "X-Amz-Signature" in signed
