"""Database engine, session dependency and migration runner.

Data access goes through the SQLModel ``Session`` provided by :func:`get_session`.
:func:`run_migrations` applies Alembic migrations on first startup (packaging hook).
"""

from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

from app.core.config import get_settings
from app.core.paths import resource_path

_settings = get_settings()
_connect_args = {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}

engine: Engine = create_engine(_settings.database_url, echo=False, connect_args=_connect_args)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    with Session(engine) as session:
        yield session


def _alembic_dir() -> Path:
    """Locate the Alembic directory in both packaged and dev runtimes."""
    bundled = Path(resource_path("alembic"))
    if bundled.is_dir():
        return bundled
    # dev: backend/alembic, relative to this file (backend/app/core/db.py)
    return Path(__file__).resolve().parents[2] / "alembic"


def run_migrations() -> None:
    """Apply all Alembic migrations up to ``head``.

    Called on application startup so the local database is created/updated
    automatically on first run. Safe to call repeatedly (idempotent).
    """
    from alembic.config import Config

    from alembic import command

    cfg = Config()
    cfg.set_main_option("script_location", str(_alembic_dir()))
    cfg.set_main_option("sqlalchemy.url", get_settings().database_url)
    command.upgrade(cfg, "head")
