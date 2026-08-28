"""Tests for the backup service (dump, restore and delete of the SQLite file).

El módulo usa el ``engine`` global de ``app.core.db``, así que aquí se
monkeypatchea ``app.services.backup.engine`` para que apunte a una base de datos
temporal y nunca se toque la BD real de desarrollo.
"""

import sqlite3
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlmodel import create_engine

from app.services import backup as service
from app.services.exceptions import ValidationError


def _make_db(path: Path) -> None:
    """Create a small but valid SQLite database at *path*."""
    conn = sqlite3.connect(str(path))
    conn.execute("CREATE TABLE things (id INTEGER PRIMARY KEY, name TEXT)")
    conn.execute("INSERT INTO things (name) VALUES ('café')")
    conn.commit()
    conn.close()


@pytest.fixture(name="db_path")
def db_path_fixture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A temporary SQLite file wired into the backup service as its engine."""
    path = tmp_path / "finapp-test.db"
    _make_db(path)
    monkeypatch.setattr(service, "engine", create_engine(f"sqlite:///{path}"))
    return path


# ── create_backup ─────────────────────────────────────────────────────────────


def test_create_backup_returns_valid_sqlite(db_path: Path, tmp_path: Path) -> None:
    data = service.create_backup()
    assert data.startswith(b"SQLite format 3")

    # La copia se puede abrir y conserva los datos del original.
    copy = tmp_path / "copy.db"
    copy.write_bytes(data)
    conn = sqlite3.connect(str(copy))
    try:
        assert conn.execute("SELECT name FROM things").fetchone()[0] == "café"
    finally:
        conn.close()


def test_create_backup_rejects_non_sqlite_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    # Basta con un doble que exponga `url`: `_db_path` sólo lee `str(engine.url)`,
    # y crear un engine real de PostgreSQL exigiría tener el driver instalado.
    monkeypatch.setattr(
        service, "engine", SimpleNamespace(url="postgresql+psycopg://user@localhost/db")
    )
    with pytest.raises(ValidationError, match="SQLite"):
        service.create_backup()


# ── restore_backup ────────────────────────────────────────────────────────────


def test_restore_backup_replaces_current_database(db_path: Path, tmp_path: Path) -> None:
    other = tmp_path / "other.db"
    conn = sqlite3.connect(str(other))
    conn.execute("CREATE TABLE things (id INTEGER PRIMARY KEY, name TEXT)")
    conn.execute("INSERT INTO things (name) VALUES ('restaurado')")
    conn.commit()
    conn.close()

    service.restore_backup(other.read_bytes())

    conn = sqlite3.connect(str(db_path))
    try:
        assert conn.execute("SELECT name FROM things").fetchone()[0] == "restaurado"
    finally:
        conn.close()


def test_restore_backup_rejects_garbage(db_path: Path) -> None:
    with pytest.raises(ValidationError):
        service.restore_backup(b"esto no es una base de datos")

    # La base de datos original sigue intacta.
    conn = sqlite3.connect(str(db_path))
    try:
        assert conn.execute("SELECT name FROM things").fetchone()[0] == "café"
    finally:
        conn.close()


def test_restore_backup_rejects_truncated_database(db_path: Path, tmp_path: Path) -> None:
    source = tmp_path / "source.db"
    _make_db(source)
    truncated = source.read_bytes()[: len(source.read_bytes()) // 2]
    with pytest.raises(ValidationError):
        service.restore_backup(truncated)


# ── delete_database ───────────────────────────────────────────────────────────


def test_delete_database_removes_file_and_runs_migrations(
    db_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[bool] = []

    def fake_run_migrations() -> None:
        calls.append(True)

    # `delete_database` importa `run_migrations` dentro de la función.
    monkeypatch.setattr("app.core.db.run_migrations", fake_run_migrations)

    service.delete_database()

    assert not db_path.exists()
    assert calls == [True]
