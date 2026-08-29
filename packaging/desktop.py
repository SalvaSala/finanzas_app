"""
Punto de entrada de la app de escritorio (FinApp).

Arranca el servidor FastAPI en un hilo en segundo plano y abre una ventana
nativa de escritorio (pywebview) que apunta al servidor local. Este es el
archivo que ejecuta el usuario final cuando hace doble clic en el instalable.
"""

from __future__ import annotations

import logging
import os
import socket
import sys
import threading
import time
from pathlib import Path

import uvicorn
import webview

HOST = "127.0.0.1"
PORT = 8765

_server_error: Exception | None = None


def _log_dir() -> Path:
    if sys.platform == "win32":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
    else:
        base = os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))
    path = Path(base) / "FinApp"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _setup_logging() -> None:
    log_file = _log_dir() / "finapp.log"
    logging.basicConfig(
        level=logging.DEBUG,
        filename=str(log_file),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def _run_server() -> None:
    global _server_error
    try:
        from app.main import app

        uvicorn.run(app, host=HOST, port=PORT, log_level="debug")
    except Exception as exc:
        _server_error = exc
        logging.exception("Error al iniciar el servidor")


def _wait_for_server(timeout: float = 30.0) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        if _server_error is not None:
            return False
        try:
            with socket.create_connection((HOST, PORT), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def main() -> None:
    _setup_logging()
    logging.info("=== FinApp iniciando ===")

    server_thread = threading.Thread(target=_run_server, daemon=True)
    server_thread.start()

    if not _wait_for_server():
        log_path = _log_dir() / "finapp.log"
        if _server_error is not None:
            logging.error("Servidor no arrancó: %s", _server_error)
        detail = (
            f"El servidor no pudo arrancar.\n"
            f"Revisa el archivo de log para más detalles:\n{log_path}"
        )
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("Error FinApp", detail)
        sys.exit(1)

    logging.info("Servidor listo, abriendo ventana...")

    # pywebview trae las descargas DESACTIVADAS de fábrica, y sin esto la app no
    # puede sacar nada al disco: el informe PDF, el export CSV y la copia de
    # seguridad se piden con un enlace normal (<a download>), y la ventana los
    # descarta. En Windows el motor las cancela explícitamente (args.Cancel) y en
    # Linux ni siquiera conecta el manejador, así que en los dos casos el fallo es
    # el mismo: no pasa nada y no hay error. Abrir ficheros sí funcionaba, porque
    # los diálogos de apertura los implementa pywebview aparte; de ahí que
    # importar CSV o restaurar la BD parecieran sanos.
    # Activado, ambos motores abren un "Guardar como" nativo en Descargas con el
    # nombre que manda el servidor en Content-Disposition.
    webview.settings["ALLOW_DOWNLOADS"] = True

    webview.create_window(
        "FinApp",
        f"http://{HOST}:{PORT}",
        width=1200,
        height=800,
        min_size=(900, 600),
    )
    webview.start()


if __name__ == "__main__":
    main()
