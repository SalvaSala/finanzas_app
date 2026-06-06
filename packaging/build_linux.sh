#!/usr/bin/env bash
# Construye FinApp para Linux. Ejecutar desde la raíz del repositorio:
#     bash packaging/build_linux.sh
set -euo pipefail

echo "==> 1/3  Compilando el frontend (React)"
pushd frontend >/dev/null
npm ci
npm run build
popd >/dev/null

echo "==> 2/3  Preparando el backend"
pushd backend >/dev/null
uv sync
uv pip install pyinstaller pywebview
popd >/dev/null

echo "==> 3/3  Empaquetando con PyInstaller"
# Ejecutamos pyinstaller con el entorno del backend
pushd backend >/dev/null
uv run pyinstaller ../packaging/finapp.spec --distpath ../dist --workpath ../build --noconfirm
popd >/dev/null

echo "==> Listo. Resultado en dist/FinApp/"
echo "    (Opcional) Empaquetar como AppImage con linuxdeploy o appimagetool."
