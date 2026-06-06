# packaging/ — Empaquetado de FinApp como app de escritorio

Esta carpeta contiene la "receta" para convertir el proyecto en un instalable de
escritorio para **Windows y Linux**. El empaquetado es el **último paso** de la
cadena: se trabaja siempre sobre el código fuente y aquí solo se **regenera** el
instalable cuando se quiere publicar una versión.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `desktop.py` | Punto de entrada de la app de escritorio: arranca FastAPI y abre la ventana (pywebview). |
| `finapp.spec` | Receta de PyInstaller: qué incluir en el paquete (estáticos del frontend, dependencias). |
| `build_linux.sh` | Construye el ejecutable en Linux. |
| `build_windows.ps1` | Construye el ejecutable en Windows. |

## Flujo de construcción

1. Compilar el frontend: `cd frontend && npm run build` → genera `frontend/dist`.
2. Empaquetar con PyInstaller usando `finapp.spec`, que mete `frontend/dist` dentro del paquete.
3. El resultado queda en `dist/FinApp/`.

Los scripts `build_linux.sh` / `build_windows.ps1` hacen los tres pasos seguidos.

> **PyInstaller no permite compilación cruzada:** el `.exe` se genera en Windows
> y el binario de Linux en Linux. Para no necesitar ambas máquinas, usar la CI de
> GitHub Actions (`.github/workflows/build.yml`).

## Ganchos que el código debe respetar (desde la Fase 1)

Para que el empaquetado funcione sin refactorizar al final, el backend debe
contemplar estos puntos desde el principio. Se recomienda implementarlos en
`backend/app/core/paths.py`:

**1. Servir los estáticos en producción.** `app/main.py` debe montar el frontend
compilado cuando corre empaquetado:

```python
# app/main.py (esquema)
from fastapi.staticfiles import StaticFiles
from app.core.paths import resource_path

app.mount("/", StaticFiles(directory=resource_path("frontend/dist"), html=True))
# La API va bajo /api para no chocar con los estáticos.
```

**2. Resolución de rutas (desarrollo vs empaquetado).** Al empaquetar, los archivos
viven en una ruta temporal distinta (`sys._MEIPASS`):

```python
# app/core/paths.py (esquema)
import sys, os

def resource_path(rel: str) -> str:
    base = getattr(sys, "_MEIPASS", os.path.abspath("."))
    return os.path.join(base, rel)
```

**3. Ubicación de la base de datos.** La BD no debe ir dentro del paquete, sino en
la carpeta de datos del usuario del sistema, creándose en el primer arranque:

```python
# app/core/paths.py (esquema)
def get_data_dir() -> str:
    if sys.platform == "win32":
        base = os.environ["APPDATA"]
    elif sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.path.expanduser("~/.local/share")
    path = os.path.join(base, "FinApp")
    os.makedirs(path, exist_ok=True)
    return path
# La cadena de conexión SQLite usa get_data_dir()/finapp.db
```

**4. Migraciones automáticas.** Aplicar las migraciones de Alembic en el primer
arranque, antes de levantar la API.

## Tras actualizar dependencias

Actualizar una librería puede funcionar en desarrollo pero romper el ejecutable
empaquetado (PyInstaller puede dejar fuera archivos nuevos). **Regla:** después de
actualizar dependencias, regenerar el instalable y probarlo, no solo el modo
desarrollo. Mantener `uv.lock` y `package-lock.json` versionados para builds
reproducibles.

## Pasos opcionales para pulir

- **Windows:** crear un instalador con asistente usando **Inno Setup**.
- **Linux:** empaquetar como **AppImage** (con `appimagetool`/`linuxdeploy`) o `.deb`.
- Añadir un icono de la app (`packaging/icon.ico`) y descomentar la línea `icon=` en `finapp.spec`.
