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
datas = [(str(FRONTEND_DIST), "frontend/dist")]

# Dependencias que PyInstaller no siempre detecta solo.
hiddenimports = (
    collect_submodules("uvicorn")
    + collect_submodules("app")          # tu paquete backend
    + ["app.main"]
)

a = Analysis(
    [str(ENTRY)],
    pathex=[str(ROOT / "backend")],      # para que `import app.main` funcione
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
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
