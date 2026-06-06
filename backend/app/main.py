"""FastAPI application entry point.

In development the app only exposes the REST API under ``/api`` (the frontend runs
on the Vite dev server and proxies ``/api`` here). In production / packaged builds,
the compiled frontend (``frontend/dist``) is served as static files from the same
process, so there is a single origin and no CORS. See ``packaging/README.md``.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.paths import resource_path

app = FastAPI(title="FinApp", version="0.1.0")

app.include_router(api_router)

# Serve the compiled frontend only when it exists (packaged / production build).
# In development this directory is absent, so nothing is mounted.
_frontend_dist = resource_path("frontend/dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
