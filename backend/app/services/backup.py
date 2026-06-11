"""Database backup and restore logic."""

import sqlite3
import tempfile
from pathlib import Path

from app.core.db import engine
from app.services.exceptions import ValidationError


def _db_path() -> Path:
    url = str(engine.url)
    if not url.startswith("sqlite:///"):
        raise ValidationError("El backup solo está disponible para bases de datos SQLite.")
    return Path(url[len("sqlite:///") :])


def create_backup() -> bytes:
    """Return a consistent byte-level copy of the database."""
    src_path = _db_path()
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        tmp = Path(f.name)
    try:
        src = sqlite3.connect(str(src_path))
        dst = sqlite3.connect(str(tmp))
        src.backup(dst)
        src.close()
        dst.close()
        return tmp.read_bytes()
    finally:
        tmp.unlink(missing_ok=True)


def restore_backup(data: bytes) -> None:
    """Validate *data* as a SQLite database and restore it, replacing the current DB."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        f.write(data)
        tmp = Path(f.name)
    try:
        conn = sqlite3.connect(str(tmp))
        try:
            result = conn.execute("PRAGMA integrity_check").fetchone()
            if result is None or result[0] != "ok":
                raise ValidationError(f"El archivo no pasa la comprobación de integridad: {result}")
        finally:
            conn.close()

        engine.dispose()

        dst_path = _db_path()
        src = sqlite3.connect(str(tmp))
        dst = sqlite3.connect(str(dst_path))
        src.backup(dst)
        src.close()
        dst.close()
    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError(f"No se pudo restaurar la copia de seguridad: {exc}") from exc
    finally:
        tmp.unlink(missing_ok=True)
