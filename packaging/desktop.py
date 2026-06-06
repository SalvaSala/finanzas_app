"""
Punto de entrada de la app de escritorio (FinApp).

Arranca el servidor FastAPI en un hilo en segundo plano y abre una ventana
nativa de escritorio (pywebview) que apunta al servidor local. Este es el
archivo que ejecuta el usuario final cuando hace doble clic en el instalable.

NOTA: en el repositorio real, este archivo puede vivir en `backend/app/desktop.py`
en lugar de en `packaging/`. Si lo mueves, ajusta la ruta del entry-point en
`finapp.spec`. Aquí lo dejamos en `packaging/` como plantilla de arranque.

Requiere que `app.main:app` (FastAPI) esté configurado para servir los estáticos
del frontend en producción. Ver packaging/README.md.
"""
from __future__ import annotations

import socket
import threading
import time

import uvicorn
import webview  # pywebview

HOST = "127.0.0.1"
PORT = 8765


def _run_server() -> None:
    # import perezoso para que PyInstaller resuelva bien las rutas
    from app.main import app

    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")


def _wait_for_server(timeout: float = 15.0) -> bool:
    """Espera a que el servidor acepte conexiones antes de abrir la ventana."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection((HOST, PORT), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def main() -> None:
    server_thread = threading.Thread(target=_run_server, daemon=True)
    server_thread.start()

    if not _wait_for_server():
        raise RuntimeError("El servidor no arrancó a tiempo")

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
