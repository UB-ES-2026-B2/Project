"""US 1.3.1: GET /api/v1/locations/suggest y filtro location_id de GET /api/v1/properties."""

import statistics
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import insert, text
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.property import Property

# usa la bd de postgres con savepoint de test_auth, sqlite no tiene unaccent ni pg_trgm
from tests.test_auth import client, db  # noqa: F401

SUGGEST = "/api/v1/locations/suggest"
PROPERTIES = "/api/v1/properties"


def make_location(
    db: Session,  # noqa: F811
    name: str,
    type_: str,
    parent: Location | None = None,
) -> Location:
    location = Location(name=name, type=type_, parent_id=parent.id if parent else None)
    db.add(location)
    db.flush()
    return location


def make_property(
    db: Session,  # noqa: F811
    neighborhood: Location | None = None,
    postal_code: Location | None = None,
) -> Property:
    prop = Property(
        title="Piso de prueba",
        location="Vilaquerta",
        price=250000,
        bedrooms=2,
        bathrooms=1,
        area=70,
        neighborhood_id=neighborhood.id if neighborhood else None,
        postal_code_id=postal_code.id if postal_code else None,
    )
    db.add(prop)
    db.flush()
    return prop


def suggest(client: TestClient, q: str) -> list[dict]:  # noqa: F811
    response = client.get(SUGGEST, params={"q": q})
    assert response.status_code == 200
    return response.json()


# --- suggest -------------------------------------------------------------------------


def test_suggest_returns_id_name_and_type(client: TestClient, db: Session) -> None:  # noqa: F811
    city = make_location(db, "Vilaquerta", "city")
    hood = make_location(db, "Vilaquerta Nord", "neighborhood", city)

    body = suggest(client, "vilaquer")

    assert body == [
        {"id": str(city.id), "name": "Vilaquerta", "type": "city"},
        {"id": str(hood.id), "name": "Vilaquerta Nord", "type": "neighborhood"},
    ]


def test_suggest_finds_postal_codes(client: TestClient, db: Session) -> None:  # noqa: F811
    city = make_location(db, "Vilaquerta", "city")
    code = make_location(db, "99871", "postal_code", city)

    body = suggest(client, "9987")

    assert body == [{"id": str(code.id), "name": "99871", "type": "postal_code"}]


@pytest.mark.parametrize("q", ["rabida", "RÀBIDA", "ràbi", "  Rabid  "])
def test_suggest_ignores_case_and_accents(client: TestClient, db: Session, q: str) -> None:  # noqa: F811
    make_location(db, "La Ràbida Xerafina", "neighborhood")

    assert [item["name"] for item in suggest(client, q)] == ["La Ràbida Xerafina"]


def test_suggest_puts_prefix_matches_first(client: TestClient, db: Session) -> None:  # noqa: F811
    for name in ["Alt Xerumbo", "Xerumbo de Baix", "Xerumbo"]:
        make_location(db, name, "neighborhood")

    names = [item["name"] for item in suggest(client, "xerumbo")]

    assert names == ["Xerumbo", "Xerumbo de Baix", "Alt Xerumbo"]


def test_suggest_returns_at_most_10(client: TestClient, db: Session) -> None:  # noqa: F811
    for i in range(15):
        make_location(db, f"Limitvila {i}", "neighborhood")

    assert len(suggest(client, "limitvila")) == 10


# con 1 o 2 letras ya coincidiria Barcelona, que viene en la migracion 004
@pytest.mark.parametrize("q", ["", "b", "ba", "  ba  "])
def test_suggest_short_query_returns_empty_list(client: TestClient, q: str) -> None:  # noqa: F811
    assert suggest(client, q) == []


def test_suggest_without_results(client: TestClient) -> None:  # noqa: F811
    assert suggest(client, "zzqxnoexiste") == []


# sin escapar, estos patrones encontrarian Barcelona
@pytest.mark.parametrize("q", ["%%%", "___", "a%c"])
def test_suggest_treats_like_wildcards_as_text(client: TestClient, q: str) -> None:  # noqa: F811
    assert suggest(client, q) == []


@pytest.mark.parametrize("params", [{}, {"q": "a" * 101}], ids=["missing", "too-long"])
def test_suggest_rejects_missing_or_too_long_query(client: TestClient, params: dict) -> None:  # noqa: F811
    assert client.get(SUGGEST, params=params).status_code == 422


# --- properties?location_id ----------------------------------------------------------


@pytest.fixture
def area(db: Session) -> dict[str, Location]:  # noqa: F811
    city = make_location(db, "Vilaquerta", "city")
    return {
        "city": city,
        "north": make_location(db, "Vilaquerta Nord", "neighborhood", city),
        "south": make_location(db, "Vilaquerta Sud", "neighborhood", city),
        "code": make_location(db, "99871", "postal_code", city),
    }


def listed(client: TestClient, **params: object) -> tuple[set[int], int]:  # noqa: F811
    response = client.get(PROPERTIES, params={"limit": 50, **params})
    assert response.status_code == 200
    body = response.json()
    return {item["id"] for item in body["items"]}, body["total"]


def test_properties_filter_by_location_id(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    area: dict[str, Location],
) -> None:
    north = make_property(db, neighborhood=area["north"], postal_code=area["code"])
    south = make_property(db, neighborhood=area["south"])
    make_property(db)  # sin ubicacion

    assert listed(client, location_id=area["city"].id) == ({north.id, south.id}, 2)
    assert listed(client, location_id=area["north"].id) == ({north.id}, 1)
    assert listed(client, location_id=area["code"].id) == ({north.id}, 1)


def test_properties_without_location_id_lists_everything(
    client: TestClient,  # noqa: F811
    db: Session,  # noqa: F811
    area: dict[str, Location],
) -> None:
    ids = {make_property(db, neighborhood=area["north"]).id, make_property(db).id}

    listed_ids, total = listed(client)

    assert ids <= listed_ids
    assert total >= 2


def test_properties_unknown_location_id_is_empty(client: TestClient) -> None:  # noqa: F811
    assert listed(client, location_id=2_000_000_000) == (set(), 0)


@pytest.mark.parametrize("bad_id", ["0", "-1", "abc", "99999999999"])
def test_properties_invalid_location_id_is_422(client: TestClient, bad_id: str) -> None:  # noqa: F811
    assert client.get(PROPERTIES, params={"location_id": bad_id}).status_code == 422


# --- latencia ------------------------------------------------------------------------

WORDS = ["Sant", "Vila", "Torre", "Mont", "Pla", "Can", "Riera", "Font", "Mas", "Puig"]
TAILS = ["Alta", "Baixa", "Nova", "Vella", "del Mar"]
QUERIES = ["sant", "torre nova", "font", "puig vel", "riera", "mas del", "vila alt", "mont"]


def test_suggest_latency_under_60_ms(client: TestClient, db: Session) -> None:  # noqa: F811
    # 5000 ubicaciones de ejemplo que se deshacen al acabar el test
    rows = [
        {"name": f"{word} {tail} {i}", "type": "neighborhood"}
        for i in range(100)
        for word in WORDS
        for tail in TAILS
    ]
    db.execute(insert(Location), rows)
    db.execute(text("ANALYZE locations"))
    for q in QUERIES[:3]:
        suggest(client, q)  # calentamiento

    timings = []
    for q in QUERIES * 3:
        start = time.perf_counter()
        suggest(client, q)
        timings.append((time.perf_counter() - start) * 1000)

    # mediana y no maximo para no fallar por un pico puntual del runner
    median = statistics.median(timings)
    assert median < 60, f"mediana {median:.1f} ms, maximo {max(timings):.1f} ms"
