# finapp.spec — receta de PyInstaller para FinApp
#
# Ejecutar DESDE LA RAÍZ del repositorio:
#     pyinstaller packaging/finapp.spec
#
# Requisito previo: haber compilado el frontend antes (genera frontend/dist):
#     cd frontend && npm run build
#
# Esto es un punto de partida; PyInstaller suele requerir ajustes ("artesanal").
# Si al ejecutar el binario falta algún módulo o archivo de datos, añádelo
# a `hiddenimports` o a `datas` respectivamente.

import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

# SPECPATH lo define PyInstaller: es la carpeta de este .spec (packaging/)
ROOT = Path(SPECPATH).parent
FRONTEND_DIST = ROOT / "frontend" / "dist"
ENTRY = ROOT / "packaging" / "desktop.py"   # ajustar si mueves desktop.py

if not FRONTEND_DIST.exists():
    raise SystemExit(
        "No existe frontend/dist. Compila el frontend antes: "
        "cd frontend && npm run build"
    )

# Incluir los estáticos compilados del frontend dentro del paquete.
# En tiempo de ejecución se localizan con resource_path() (ver core/paths.py).
# También se incluye el directorio alembic/ con las migraciones SQL,
# necesario para que run_migrations() funcione en el primer arranque.
ALEMBIC_DIR = ROOT / "backend" / "alembic"
datas = [
    (str(FRONTEND_DIST), "frontend/dist"),
    (str(ALEMBIC_DIR), "alembic"),
]

# ── gi / PyGObject ────────────────────────────────────────────────────────────
# Solo incluimos los módulos Python de gi (no coleccionar datos: evita
# arrastrar 1.5 GB de iconos GTK y temas que no son necesarios en el bundle).
# Los typelibs que necesita pywebview se añaden manualmente; un runtime hook
# (rthook_gi_typelib.py) ajusta GI_TYPELIB_PATH al arranque del binario.
TYPELIB_SRC = "/usr/lib/x86_64-linux-gnu/girepository-1.0"
NEEDED_TYPELIBS = [
    "WebKit2-4.0",
    "WebKit2WebExtension-4.0",
    "JavaScriptCore-4.0",
    "Soup-2.4",
    "Gtk-3.0",
    "Gdk-3.0",
    "GdkPixbuf-2.0",
    "GdkX11-3.0",
    "Gio-2.0",
    "GLib-2.0",
    "GObject-2.0",
    "GModule-2.0",
    "Pango-1.0",
    "PangoCairo-1.0",
    "Atk-1.0",
    "HarfBuzz-0.0",
    "cairo-1.0",
]
gi_typelib_datas = [
    (os.path.join(TYPELIB_SRC, f"{name}.typelib"), "girepository-1.0")
    for name in NEEDED_TYPELIBS
    if os.path.exists(os.path.join(TYPELIB_SRC, f"{name}.typelib"))
]

gi_hiddenimports = collect_submodules("gi")
pycairo_hiddenimports = collect_submodules("cairo")

# Dependencias que PyInstaller no siempre detecta solo.
hiddenimports = (
    collect_submodules("uvicorn")
    + collect_submodules("app")          # tu paquete backend
    + ["app.main"]
    + gi_hiddenimports
    + pycairo_hiddenimports
)

a = Analysis(
    [str(ENTRY)],
    pathex=[str(ROOT / "backend")],      # para que `import app.main` funcione
    binaries=[],
    datas=datas + gi_typelib_datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={
        "gi": {
            # Solo tema base (sin Adwaita ni otros — evita 1.5 GB de iconos)
            "icons": ["hicolor"],
            "themes": ["Default"],
            "languages": [],
        }
    },
    runtime_hooks=[str(ROOT / "packaging" / "rthook_gi_typelib.py")],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="FinApp",
    debug=False,
    console=False,                       # app de ventana, sin consola
    disable_windowed_traceback=False,
    # icon="packaging/icon.ico",         # (opcional) icono de la app
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    name="FinApp",                       # genera dist/FinApp/ (modo onedir)
)
