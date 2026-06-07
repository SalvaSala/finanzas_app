"""Shared pytest fixtures."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401  (registers all tables on SQLModel.metadata)
from app.core.db import get_session
from app.main import app as fastapi_app


@pytest.fixture(name="session")
def session_fixture() -> Generator[Session, None, None]:
    """An isolated in-memory database session for each test.

    ``StaticPool`` keeps a single shared connection so that the schema created
    here is visible to the FastAPI request handlers in the ``client`` fixture.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session) -> Generator[TestClient, None, None]:
    """A TestClient whose ``get_session`` dependency uses the test session."""

    def get_session_override() -> Generator[Session, None, None]:
        yield session

    fastapi_app.dependency_overrides[get_session] = get_session_override
    # Plain instantiation (no context manager) so the app lifespan does not run
    # migrations/seeding against the real dev database during tests.
    client = TestClient(fastapi_app)
    yield client
    fastapi_app.dependency_overrides.clear()
