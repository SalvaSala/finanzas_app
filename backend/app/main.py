"""FastAPI application entry point.

In development the app only exposes the REST API under ``/api`` (the frontend runs
on the Vite dev server and proxies ``/api`` here). In production / packaged builds,
the compiled frontend (``frontend/dist``) is served as static files from the same
process, so there is a single origin and no CORS. See ``packaging/README.md``.

On startup, Alembic migrations are applied and the default seed data is inserted,
so the local database is created/updated and usable on first run.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response
from starlette.types import Scope

from app.api import api_router
from app.core.db import engine, run_migrations
from app.core.paths import resource_path
from app.services import recurring as recurring_service
from app.services.exceptions import NotFoundError, ValidationError
from app.services.seed import seed_initial_data


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    run_migrations()
    with Session(engine) as session:
        seed_initial_data(session)
        # Catch up any recurring movements due since the last run.
        recurring_service.run_due(session)
    yield


app = FastAPI(title="FinApp", version="1.0.0", lifespan=lifespan)


@app.exception_handler(NotFoundError)
async def _handle_not_found(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ValidationError)
async def _handle_validation(request: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


app.include_router(api_router)


class SpaStaticFiles(StaticFiles):
    """Static files with a single-page-application fallback.

    Las rutas del SPA (``/transacciones``, ``/graficos``...) no existen como fichero
    en disco: las resuelve React Router en el cliente. Si el servidor devuelve 404,
    recargar la página o abrir un enlace directo rompe la app empaquetada.

    Se subclasea ``StaticFiles`` en lugar de registrar una ruta catch-all porque el
    montaje en ``/`` absorbe todas las peticiones que no casan con una ruta previa:
    un catch-all registrado después nunca llegaría a ejecutarse. Aquí solo se
    intercepta el 404 del propio ``StaticFiles``, así que los ficheros reales se
    siguen sirviendo con su tipo MIME y sus cabeceras habituales.
    """

    # Prefijos que nunca deben caer en el index: la API (un endpoint inexistente
    # tiene que fallar como error, no devolver una página) y los assets compilados
    # (si falta un chunk, es mejor un 404 claro que un HTML servido como JS/CSS).
    _NO_FALLBACK_PREFIXES = ("/api", "/assets")

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            request_path = str(scope.get("path", ""))
            excluded = any(
                request_path == prefix or request_path.startswith(prefix + "/")
                for prefix in self._NO_FALLBACK_PREFIXES
            )
            if exc.status_code == 404 and not excluded:
                return await super().get_response("index.html", scope)
            raise


def mount_frontend(app: FastAPI, directory: str) -> None:
    """Mount the compiled frontend at ``/`` with the SPA fallback enabled."""
    app.mount("/", SpaStaticFiles(directory=directory, html=True), name="frontend")


# Serve the compiled frontend only when it exists (packaged / production build).
# In development this directory is absent, so nothing is mounted.
_frontend_dist = resource_path("frontend/dist")
if os.path.isdir(_frontend_dist):
    mount_frontend(app, _frontend_dist)
