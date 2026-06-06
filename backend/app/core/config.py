"""Application settings.

The database URL is environment-agnostic so the same backend runs locally
(SQLite) and, in the future, in the cloud (PostgreSQL) by changing only this value.
Override with the ``FINAPP_DATABASE_URL`` environment variable (or a ``.env`` file).
"""

from __future__ import annotations

import sys
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.paths import get_database_path, get_dev_database_path


def _default_database_url() -> str:
    """SQLite in the OS user-data dir when packaged; repo ``data/`` dir in dev."""
    if getattr(sys, "frozen", False):
        return f"sqlite:///{get_database_path()}"
    return f"sqlite:///{get_dev_database_path()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FINAPP_", env_file=".env", extra="ignore")

    database_url: str = Field(default_factory=_default_database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
