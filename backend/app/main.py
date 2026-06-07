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

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session

from app.api import api_router
from app.core.db import engine, run_migrations
from app.core.paths import resource_path
from app.services.seed import seed_initial_data


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    run_migrations()
    with Session(engine) as session:
        seed_initial_data(session)
    yield


app = FastAPI(title="FinApp", version="0.1.0", lifespan=lifespan)

app.include_router(api_router)

# Serve the compiled frontend only when it exists (packaged / production build).
# In development this directory is absent, so nothing is mounted.
_frontend_dist = resource_path("frontend/dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
