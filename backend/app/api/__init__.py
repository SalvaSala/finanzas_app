"""REST API routers. Everything is mounted under the ``/api`` prefix."""

from __future__ import annotations

from fastapi import APIRouter

from app.api import health

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
