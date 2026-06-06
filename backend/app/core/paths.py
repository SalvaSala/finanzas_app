"""Path resolution for development vs packaged (PyInstaller) runtime.

These helpers centralize the packaging hooks described in ``packaging/README.md``:

- :func:`resource_path` locates bundled resources (e.g. the compiled frontend),
  resolving ``sys._MEIPASS`` when running inside a PyInstaller bundle.
- :func:`get_data_dir` returns the per-user OS data directory where the SQLite
  database must live (never inside the bundle), creating it on first use.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = "FinApp"
DB_FILENAME = "finapp.db"


def resource_path(rel: str) -> str:
    """Return the absolute path to a bundled resource.

    In a PyInstaller bundle, files are extracted to a temporary directory exposed
    as ``sys._MEIPASS``. In development the base is the current working directory.
    """
    base = getattr(sys, "_MEIPASS", os.path.abspath("."))
    return os.path.join(base, rel)


def get_data_dir() -> str:
    """Return the per-user data directory for FinApp, creating it if needed.

    The database is stored here (outside the bundle) so it survives reinstalls
    and updates of the packaged application.
    """
    if sys.platform == "win32":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
    elif sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))
    path = os.path.join(base, APP_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def get_database_path() -> str:
    """Return the absolute path to the local SQLite database file."""
    return str(Path(get_data_dir()) / DB_FILENAME)
