#!/usr/bin/env bash
# Genera un AppImage de FinApp para Linux (x86_64).
#
# Prerequisito: haber ejecutado build_linux.sh antes (genera dist/FinApp/).
# Ejecutar DESDE LA RAÍZ del repositorio:
#     bash packaging/build_appimage.sh
#
# Resultado: dist/FinApp-x86_64.AppImage  (~100 MB, un único fichero)
# Para ejecutarlo: chmod +x FinApp-x86_64.AppImage && ./FinApp-x86_64.AppImage
set -euo pipefail

DIST_DIR="$(pwd)/dist/FinApp"
APP_DIR="$(pwd)/dist/AppDir"
OUT="$(pwd)/dist/FinApp-x86_64.AppImage"
TOOL="$(pwd)/dist/appimagetool-x86_64.AppImage"
ICON="$(pwd)/packaging/finapp.png"

# ── 1. Verificar que el build de PyInstaller existe ───────────────────────────
if [[ ! -f "$DIST_DIR/FinApp" ]]; then
    echo "ERROR: $DIST_DIR/FinApp no existe."
    echo "Ejecuta primero: bash packaging/build_linux.sh"
    exit 1
fi

echo "==> 1/4  Preparando AppDir"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"

# Copiar el contenido de PyInstaller
cp -r "$DIST_DIR"/. "$APP_DIR/"

# ── 2. AppRun — punto de entrada del AppImage ─────────────────────────────────
cat > "$APP_DIR/AppRun" << 'APPRUN'
#!/bin/bash
# Punto de entrada del AppImage: resuelve rutas y lanza el binario.
SELF=$(readlink -f "$0")
HERE="${SELF%/*}"
export PATH="${HERE}:${PATH}"
export LD_LIBRARY_PATH="${HERE}/_internal:${LD_LIBRARY_PATH:-}"
exec "${HERE}/FinApp" "$@"
APPRUN
chmod +x "$APP_DIR/AppRun"

# ── 3. .desktop — metadatos para el sistema ───────────────────────────────────
cat > "$APP_DIR/finapp.desktop" << 'DESKTOP'
[Desktop Entry]
Name=FinApp
Comment=App de finanzas personales
Exec=FinApp
Icon=finapp
Type=Application
Categories=Office;Finance;
Keywords=finanzas;dinero;gastos;presupuesto;
StartupNotify=true
DESKTOP

# ── 4. Icono ──────────────────────────────────────────────────────────────────
if [[ -f "$ICON" ]]; then
    cp "$ICON" "$APP_DIR/finapp.png"
else
    echo "AVISO: no se encontró $ICON — el AppImage se creará sin icono."
fi

# ── 5. Descargar appimagetool si no está en caché ────────────────────────────
echo "==> 2/4  Obteniendo appimagetool"
if [[ ! -f "$TOOL" ]]; then
    echo "    Descargando appimagetool..."
    curl -L -o "$TOOL" \
        "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x "$TOOL"
else
    echo "    appimagetool ya en caché, reutilizando."
fi

# ── 6. Construir el AppImage ──────────────────────────────────────────────────
echo "==> 3/4  Construyendo $OUT"
ARCH=x86_64 "$TOOL" "$APP_DIR" "$OUT" 2>&1

echo "==> 4/4  Listo"
echo ""
echo "    Fichero generado: $OUT"
du -sh "$OUT"
echo ""
echo "    Para ejecutarlo:"
echo "      chmod +x $OUT"
echo "      $OUT"
