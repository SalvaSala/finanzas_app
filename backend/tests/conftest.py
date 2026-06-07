"""Shared pytest fixtures."""

from collections.abc import Generator

import pytest
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401  (registers all tables on SQLModel.metadata)


@pytest.fixture(name="session")
def session_fixture() -> Generator[Session, None, None]:
    """An isolated in-memory database session for each test."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
