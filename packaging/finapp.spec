# finapp.spec — receta de PyInstaller para FinApp
#
# Ejecutar DESDE LA RAÍZ del repositorio:
#     pyinstaller packaging/finapp.spec
#
# Requisito previo: haber compilado el frontend antes (genera frontend/dist):
#     cd frontend && npm run build
#
# Compatible con Linux y Windows. En Linux incluye PyGObject/GTK/WebKit2
# (necesario para pywebview); en Windows usa WebView2 nativo.

import os
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

PLATFORM = sys.platform

# SPECPATH lo define PyInstaller: es la carpeta de este .spec (packaging/)
ROOT = Path(SPECPATH).parent
FRONTEND_DIST = ROOT / "frontend" / "dist"
ENTRY = ROOT / "packaging" / "desktop.py"

if not FRONTEND_DIST.exists():
    raise SystemExit(
        "No existe frontend/dist. Compila el frontend antes: "
        "cd frontend && npm run build"
    )

ALEMBIC_DIR = ROOT / "backend" / "alembic"
# Las fuentes DejaVu las carga fpdf2 por ruta de fichero al generar el informe PDF
# (app/services/report.py). Sin incluirlas, el binario levanta pero /api/reports/pdf
# falla con "TTF Font file not found".
FONTS_DIR = ROOT / "backend" / "app" / "resources" / "fonts"
if not FONTS_DIR.is_dir():
    raise SystemExit(f"No existen las fuentes del informe PDF en {FONTS_DIR}")

datas = [
    (str(FRONTEND_DIST), "frontend/dist"),
    (str(ALEMBIC_DIR), "alembic"),
    (str(FONTS_DIR), "app/resources/fonts"),
]

runtime_hooks = []
hiddenimports = list(collect_submodules("uvicorn"))
hooksconfig = {}

if PLATFORM == "linux":
    # WebKit2 viene en dos sabores según la distro y NO son intercambiables: la 4.1
    # va con Soup 3.0 (Ubuntu 24.04 en adelante, y es la única que trae el runner de
    # la CI) y la 4.0 con Soup 2.4 (distros más antiguas). Se usa la que haya.
    WEBKIT_VARIANTS = [("4.1", "Soup-3.0"), ("4.0", "Soup-2.4")]

    BASE_TYPELIBS = [
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
    typelib_src = "/usr/lib/x86_64-linux-gnu/girepository-1.0"

    def _has_typelib(name):
        return os.path.exists(os.path.join(typelib_src, f"{name}.typelib"))

    # Elegir la variante de WebKit disponible. Antes se pedía la 4.0 a secas y las
    # que faltaban se omitían en silencio: en una distro con solo la 4.1 el binario
    # se construía sin WebKit y la ventana no abría, sin ningún aviso.
    webkit_typelibs = None
    for version, soup in WEBKIT_VARIANTS:
        candidate = [
            f"WebKit2-{version}",
            f"WebKit2WebExtension-{version}",
            f"JavaScriptCore-{version}",
            soup,
        ]
        if all(_has_typelib(name) for name in candidate):
            webkit_typelibs = candidate
            break

    if webkit_typelibs is None:
        raise SystemExit(
            f"No se encontró ninguna versión de WebKit2 en {typelib_src}.\n"
            "Sin ella el binario se construye pero la ventana no abre. Instala:\n"
            "  sudo apt install gir1.2-webkit2-4.1   # Ubuntu 24.04+\n"
            "  sudo apt install gir1.2-webkit2-4.0   # distros más antiguas"
        )

    INCLUDE_TYPELIBS = webkit_typelibs + BASE_TYPELIBS

    missing = [name for name in INCLUDE_TYPELIBS if not _has_typelib(name)]
    if missing:
        raise SystemExit(
            "Faltan typelibs necesarios para la ventana: " + ", ".join(missing) + "\n"
            "Instala gir1.2-gtk-3.0 y las librerías indicadas en packaging/README.md."
        )

    datas += [
        (os.path.join(typelib_src, f"{name}.typelib"), "girepository-1.0")
        for name in INCLUDE_TYPELIBS
    ]

    hiddenimports += collect_submodules("gi")
    hiddenimports += collect_submodules("cairo")

    hooksconfig["gi"] = {
        "icons": ["hicolor"],
        "themes": ["Default"],
        "languages": [],
    }

    runtime_hooks.append(str(ROOT / "packaging" / "rthook_gi_typelib.py"))

hiddenimports += collect_submodules("app")
hiddenimports += ["app.main"]

a = Analysis(
    [str(ENTRY)],
    pathex=[str(ROOT / "backend")],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig=hooksconfig,
    runtime_hooks=runtime_hooks,
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
    console=False,
    disable_windowed_traceback=False,
    # icon="packaging/icon.ico",
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    name="FinApp",
)
