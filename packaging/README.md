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
| `build_appimage.sh` | Empaqueta el resultado de `build_linux.sh` en un AppImage de un solo fichero. |
| `finapp.iss` | Receta de Inno Setup: convierte `dist\FinApp` en el instalador de Windows. |

## Requisitos previos

**Dependencias de Python.** Las herramientas de empaquetado viven en el grupo
`packaging` de `backend/pyproject.toml`, aparte de las de desarrollo. Los scripts
de construcción las instalan con `uv sync --group packaging`; un `uv sync` normal
**no** las trae, para no exigir las librerías de GTK a quien solo desarrolla.

**Librerías del sistema (solo Linux).** En Linux, pywebview abre la ventana con
GTK/WebKit a través de **PyGObject**, que se compila contra las cabeceras del
sistema. Sin ellas la construcción falla (los scripts lo comprueban y avisan):

```bash
# Ubuntu 24.04 o posterior (y el runner de la CI)
sudo apt install libgirepository1.0-dev libcairo2-dev gir1.2-webkit2-4.1 gir1.2-gtk-3.0

# Distros más antiguas (Ubuntu 22.04, Mint 21...), que traen la 4.0
sudo apt install libgirepository1.0-dev libcairo2-dev gir1.2-webkit2-4.0 gir1.2-gtk-3.0
```

> ⚠️ **Este es el fallo más fácil de pasar por alto.** Si PyGObject no está
> instalado en el entorno, el binario **se genera igual y arranca**, pero la
> ventana nunca abre: `finapp.spec` hace `collect_submodules("gi")`, que sin
> PyGObject no recoge nada, y la app muere con `No module named 'gi'`. El
> servidor interno funciona, así que el fallo parece "la app no hace nada".
> `build_linux.sh` comprueba estas librerías antes de empezar precisamente por eso.

En Windows no hace falta nada de esto: pywebview usa **EdgeChromium**, y el
marcador `sys_platform == 'linux'` de `pyproject.toml` deja PyGObject fuera.

## Flujo de construcción

1. Compilar el frontend: `cd frontend && npm run build` → genera `frontend/dist`.
2. Empaquetar con PyInstaller usando `finapp.spec`, que mete `frontend/dist` dentro del paquete.
3. El resultado queda en `dist/FinApp/`.

Los scripts `build_linux.sh` / `build_windows.ps1` hacen los tres pasos seguidos.

### Qué mete `finapp.spec` en el paquete

Todo lo que el backend lee **por ruta de fichero** hay que declararlo aquí, o el
binario falla en tiempo de ejecución aunque se construya sin errores:

| Recurso | Destino | Para qué |
|---|---|---|
| `frontend/dist` | `frontend/dist` | La interfaz compilada que sirve FastAPI. |
| `backend/alembic` | `alembic` | Migraciones, que se aplican en el primer arranque. |
| `backend/app/resources/fonts` | `app/resources/fonts` | Fuentes DejaVu del informe PDF (fpdf2 las abre por ruta). |
| typelibs de GI (solo Linux) | `girepository-1.0` | GTK/WebKit para la ventana. |

**Sobre las versiones de WebKit2.** Hay dos y no son intercambiables: la **4.1**
va con Soup 3.0 (Ubuntu 24.04+) y la **4.0** con Soup 2.4 (distros anteriores).
`finapp.spec` detecta cuál hay en el sistema y empaqueta el juego completo que
corresponda; si no encuentra ninguna, **aborta la construcción**. Antes pedía la
4.0 a secas y omitía en silencio lo que faltara, de modo que en un sistema con
solo la 4.1 el binario salía sin WebKit y la ventana no abría.

> **PyInstaller no permite compilación cruzada:** el `.exe` se genera en Windows
> y el binario de Linux en Linux. Para no necesitar ambas máquinas, usar la CI de
> GitHub Actions (`.github/workflows/build.yml`).

### Del directorio al fichero único (AppImage, solo Linux)

Lo que deja PyInstaller son **dos piezas inseparables**: el ejecutable `FinApp` y
una carpeta `_internal/` de unos 200 MB. Si se mueve una sin la otra, no arranca.
`build_appimage.sh` las mete en un **AppImage**: un único fichero de ~78 MB que se
ejecuta con doble clic, sin instalar nada ni descomprimir.

```bash
bash packaging/build_linux.sh      # 1º: genera dist/FinApp/
bash packaging/build_appimage.sh   # 2º: genera dist/FinApp-x86_64.AppImage
```

El orden importa: el segundo script empaqueta lo que encuentre en `dist/FinApp`.

Un AppImage **hereda el glibc del binario que lleva dentro**; no arregla la
compatibilidad, la empaqueta tal cual. Por eso, para publicar, el binario debe venir
de la CI (Ubuntu 22.04) y no de la máquina de desarrollo.

> `appimagetool` es a su vez un AppImage y necesita **libfuse2** para automontarse.
> Donde no está (los runners de GitHub, contenedores), el script exporta
> `APPIMAGE_EXTRACT_AND_RUN=1` para que se extraiga en un temporal en lugar de
> montarse. Se puede forzar a mano para reproducir en local lo que hace la CI.

### Del directorio al instalador (Inno Setup, solo Windows)

Windows tiene el mismo problema que Linux —el `.exe` y `_internal\` son
inseparables— pero no existe un equivalente al AppImage. La solución idiomática es
un **instalador**: `packaging/finapp.iss` produce un `FinApp-1.0.0-setup.exe` que
copia todo a la carpeta de programas del usuario y deja acceso directo en el menú
Inicio y desinstalador en el panel de control.

```powershell
powershell -File packaging\build_windows.ps1    # hace las dos cosas
iscc packaging\finapp.iss /DAppVersion=1.0.0    # solo el instalador
```

Tres decisiones que conviene conocer antes de tocar el `.iss`:

- **`AppId` es un GUID fijo.** Es lo que identifica la app entre versiones: mientras
  no cambie, un instalador nuevo *actualiza* la instalación en vez de crear una
  segunda copia. No tocarlo nunca.
- **`PrivilegesRequired=lowest`**: instala en la carpeta de programas del usuario y
  **no lanza el aviso de UAC**. La base de datos vive en `%APPDATA%`, no en la
  carpeta de instalación, así que desinstalar no borra los datos.
- **La versión se pasa con `/DAppVersion`**, leída de `backend/pyproject.toml`. El
  número ya vive en cinco sitios; no se añade un sexto que se quede viejo.

El `.exe` no está firmado, así que **SmartScreen avisará** al descargarlo
(*Más información → Ejecutar de todas formas*). Evitarlo requiere un certificado de
firma de código de pago.

### Qué publica la CI

`build.yml` adjunta a la release **un solo fichero descargable por sistema**:

| Sistema | Fichero | Cómo se usa |
|---|---|---|
| Linux | `FinApp-x86_64.AppImage` | `chmod +x` y ejecutar; o doble clic. |
| Windows | `FinApp-1.0.0-setup.exe` | Doble clic → asistente de instalación. |

El zip de la carpeta suelta (`FinApp-windows-x86_64.zip`) se sigue generando como
artefacto del run —sirve para depurar y para quien la quiera portable— pero **no**
se adjunta a la release, para no obligar al usuario a elegir.

Ambos se suben **dos veces**, y la diferencia importa:

- Como **artefacto del run** (siempre, también en lanzamientos manuales): sirve para
  probar antes de publicar. Vive en la pestaña Actions y **caduca a los 90 días**.
- Como **adjunto de la release** (solo cuando el disparador es una release
  publicada): es lo que ve quien entra a descargar la app, y es permanente.

Antes el workflow solo hacía lo primero, así que la página de la release salía sin
ficheros: la app estaba construida pero no había forma de descargarla.

### Sobre qué versión de Linux construir

`glibc`, la librería base del sistema, **solo es compatible hacia adelante**: un
binario construido con una versión antigua funciona en sistemas nuevos, pero uno
construido con una versión nueva **no arranca** en sistemas antiguos, y falla así:

```
ImportError: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.38' not found
```

Por eso el workflow fija `ubuntu-22.04` (glibc 2.35) en lugar de `ubuntu-latest`:
así el binario sirve para Ubuntu 22.04 y todo lo posterior, incluidas las distros
derivadas como **Linux Mint 21**. Construir en `ubuntu-latest` dejaría fuera a
cualquiera con un sistema de más de un par de años.

**Regla:** construir siempre en la versión más antigua que se quiera soportar, no
en la más reciente. Si algún día hay que subirla, se pierde compatibilidad con las
distros viejas: es una decisión de a quién se deja atrás, no un detalle técnico.

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

## Cómo comprobar que el instalable está bien

Que la construcción termine sin errores **no** significa que el instalable
funcione: los fallos de empaquetado aparecen en tiempo de ejecución, cuando falta
un fichero que el código abre por ruta. Recorrer esta lista sobre el binario de
`dist/FinApp/`, no sobre el modo desarrollo:

```bash
cd dist/FinApp && ./FinApp
```

1. **La ventana abre.** Es lo primero y lo que más se ha roto históricamente. Si
   solo se comprueba que el servidor responde, un binario sin PyGObject parece sano.
   Se puede verificar sin mirar la pantalla con `wmctrl -l | grep FinApp`.
2. **La interfaz se ve y los gráficos pintan** (ECharts sobre WebKit, que no es el
   mismo motor que el navegador de desarrollo).
3. **Las tres descargas funcionan PULSANDO EL BOTÓN EN LA VENTANA**, no con `curl`:
   el informe PDF (panel principal), el export CSV (movimientos) y la copia de
   seguridad (ajustes). Debe abrirse un diálogo nativo de "Guardar como" y quedar
   el fichero en disco.
4. **Las dos subidas funcionan**: importar CSV y restaurar la base de datos abren
   el diálogo de selección de fichero y lo procesan.
5. **Los enlaces directos funcionan**: `/transacciones`, `/graficos` → 200 (no 404).
6. **Con la BD borrada, la app arranca y la recrea** aplicando las migraciones.

> ⚠️ **`curl` no vale para comprobar las descargas.** Prueba el servidor, no la
> ventana, y son dos cosas distintas: pywebview trae `ALLOW_DOWNLOADS` desactivado
> de fábrica, así que el servidor devolvía el PDF correctamente **y la ventana lo
> tiraba a la basura sin decir nada**. En Windows el motor cancela la descarga
> (`args.Cancel = True`) y en Linux ni conecta el manejador: en ambos casos, ni
> error ni aviso. Las subidas seguían funcionando —los diálogos de apertura los
> implementa pywebview aparte—, lo que hacía pensar que la app estaba sana.
> La lista de antes decía "comprobar con `curl`" y por eso el fallo sobrevivió a
> todas las verificaciones anteriores.

## Tras actualizar dependencias

Actualizar una librería puede funcionar en desarrollo pero romper el ejecutable
empaquetado (PyInstaller puede dejar fuera archivos nuevos). **Regla:** después de
actualizar dependencias, regenerar el instalable y probarlo con la lista de arriba,
no solo el modo desarrollo. Mantener `uv.lock` y `package-lock.json` versionados
para builds reproducibles.

## Pasos opcionales para pulir

- **Linux:** empaquetar como **AppImage** (con `appimagetool`/`linuxdeploy`) o `.deb`.
- Añadir un icono de la app (`packaging/icon.ico`) y descomentar la línea `icon=` en `finapp.spec`.
