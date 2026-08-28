"""Tests for the SPA fallback used when the packaged app serves ``frontend/dist``.

En los tests ese directorio no existe (solo se genera al compilar el frontend), así
que se fabrica uno temporal con un ``index.html`` y un ``assets/`` falsos y se monta
sobre la aplicación real, deshaciendo el montaje al terminar para no contaminar el
resto de la suite.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.db import get_session
from app.core.paths import resource_path
from app.main import app as fastapi_app
from app.main import mount_frontend

INDEX_HTML = '<!doctype html><html><head><title>FinApp</title></head><body><div id="root"></div></body></html>'  # noqa: E501
ASSET_JS = 'console.log("finapp");\n'


@pytest.fixture(name="spa_client")
def spa_client_fixture(session: Session, tmp_path: Path) -> Generator[TestClient, None, None]:
    """A TestClient against the real app with a fake compiled frontend mounted."""
    dist = tmp_path / "frontend" / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(INDEX_HTML, encoding="utf-8")
    (dist / "assets" / "index-abc123.js").write_text(ASSET_JS, encoding="utf-8")

    def get_session_override() -> Generator[Session, None, None]:
        yield session

    fastapi_app.dependency_overrides[get_session] = get_session_override
    routes_before = list(fastapi_app.router.routes)
    mount_frontend(fastapi_app, str(dist))
    # Sin context manager: el lifespan migraría/sembraría la base de datos real.
    client = TestClient(fastapi_app)
    yield client
    fastapi_app.router.routes[:] = routes_before
    fastapi_app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "path",
    ["/", "/transacciones", "/graficos", "/presupuestos", "/ajustes"],
)
def test_spa_routes_serve_index(spa_client: TestClient, path: str) -> None:
    response = spa_client.get(path)
    assert response.status_code == 200
    assert 'id="root"' in response.text
    assert response.headers["content-type"].startswith("text/html")


def test_nested_spa_route_serves_index(spa_client: TestClient) -> None:
    response = spa_client.get("/transacciones/42/editar")
    assert response.status_code == 200
    assert 'id="root"' in response.text


def test_api_still_works(spa_client: TestClient) -> None:
    response = spa_client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_api_endpoint_returns_404(spa_client: TestClient) -> None:
    response = spa_client.get("/api/no-existe")
    assert response.status_code == 404
    assert 'id="root"' not in response.text


def test_unknown_api_resource_returns_404_json(spa_client: TestClient) -> None:
    response = spa_client.get("/api/transactions/999999")
    assert response.status_code == 404
    assert "detail" in response.json()


def test_real_static_file_is_served_as_is(spa_client: TestClient) -> None:
    response = spa_client.get("/assets/index-abc123.js")
    assert response.status_code == 200
    assert response.text == ASSET_JS
    assert "javascript" in response.headers["content-type"]


def test_missing_asset_returns_404_not_index(spa_client: TestClient) -> None:
    """Un chunk que no existe debe dar 404, no un HTML servido como JavaScript."""
    response = spa_client.get("/assets/index-noexiste.js")
    assert response.status_code == 404
    assert 'id="root"' not in response.text


def test_openapi_and_docs_still_available(spa_client: TestClient) -> None:
    assert spa_client.get("/openapi.json").status_code == 200
    assert spa_client.get("/docs").status_code == 200


def test_frontend_mounted_only_when_dist_exists() -> None:
    """En desarrollo no hay ``frontend/dist`` y no debe montarse nada."""
    mounted = any(getattr(route, "name", None) == "frontend" for route in fastapi_app.router.routes)
    assert mounted is os.path.isdir(resource_path("frontend/dist"))
