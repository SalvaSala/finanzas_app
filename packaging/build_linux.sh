#!/usr/bin/env bash
# Construye FinApp para Linux. Ejecutar desde la raíz del repositorio:
#     bash packaging/build_linux.sh
set -euo pipefail

# Activar nvm y Node 20 (requerido por Tailwind v4 / react-router v7)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
nvm use 20

echo "==> 1/3  Compilando el frontend (React)"
pushd frontend >/dev/null
npm ci
npm run build
popd >/dev/null

echo "==> 2/3  Preparando el backend"

# PyGObject se compila contra las cabeceras de gobject-introspection y cairo, y en
# tiempo de ejecución necesita el typelib de WebKit2. Si falta algo, es mejor parar
# aquí con un mensaje claro que descubrirlo con un binario que no abre la ventana.
missing_pkgs=()
pkg-config --exists gobject-introspection-1.0 || missing_pkgs+=("libgirepository1.0-dev")
pkg-config --exists cairo || missing_pkgs+=("libcairo2-dev")
# Sirve la 4.1 (Ubuntu 24.04+) o la 4.0 (distros más antiguas); finapp.spec
# empaqueta la que encuentre.
ls /usr/lib/*/girepository-1.0/WebKit2-4.*.typelib >/dev/null 2>&1 \
    || missing_pkgs+=("gir1.2-webkit2-4.1")

if (( ${#missing_pkgs[@]} > 0 )); then
    echo "ERROR: faltan librerías de sistema necesarias para la ventana de escritorio:" >&2
    printf '  - %s\n' "${missing_pkgs[@]}" >&2
    echo >&2
    echo "Instálalas con:" >&2
    echo "  sudo apt install ${missing_pkgs[*]}" >&2
    exit 1
fi

pushd backend >/dev/null
# El grupo `packaging` trae PyInstaller y, en Linux, PyGObject: sin él la ventana
# no abre porque finapp.spec no encuentra el módulo `gi`.
uv sync --group packaging
popd >/dev/null

echo "==> 3/3  Empaquetando con PyInstaller"
# Ejecutamos pyinstaller con el entorno del backend
pushd backend >/dev/null
uv run pyinstaller ../packaging/finapp.spec --distpath ../dist --workpath ../build --noconfirm
popd >/dev/null

echo "==> Listo. Resultado en dist/FinApp/"
echo "    (Opcional) Empaquetar como AppImage con linuxdeploy o appimagetool."
