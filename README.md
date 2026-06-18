# FinApp — App de finanzas personales

Aplicación de finanzas personales para registrar ingresos y gastos y analizarlos en un dashboard.
Empieza como app de escritorio **local** (Windows y Linux) y está preparada para llevarse a la **nube** más adelante.

## Stack

- **Backend:** Python · FastAPI · SQLModel · SQLite (→ PostgreSQL) · Alembic
- **Frontend:** React · Vite · TypeScript · TailwindCSS · shadcn/ui · Recharts
- **Empaquetado:** FastAPI sirve el frontend compilado + pywebview + PyInstaller

## Requisitos previos

- **Python** 3.11+ y **uv** (gestor de dependencias Python)
- **Node.js** 20+ y **npm** (gestor de dependencias del frontend)

## Arranque rápido (desarrollo)

Se trabaja con **dos terminales** a la vez.

**Terminal 1 — backend:**
```bash
cd backend
uv sync
uv run alembic upgrade head        # crear/actualizar la base de datos
uv run uvicorn app.main:app --reload
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```

Abre la URL que indique Vite en el navegador. El frontend habla con la API del backend.

## Empaquetado (instalable Linux AppImage)

### Build completo (primera vez o tras cambios grandes)

```bash
# 1. Frontend
cd frontend
nvm use 20          # Node 20+ necesario para Tailwind v4
npm run build       # genera frontend/dist

# 2. Bundle PyInstaller (desde backend/)
cd ../backend
uv run pyinstaller ../packaging/finapp.spec --noconfirm
# resultado: backend/dist/FinApp/

# 3. Copiar al directorio raíz y generar AppImage
cd ..
cp -r backend/dist/FinApp dist/FinApp    # sobreescribe el anterior
bash packaging/build_appimage.sh
# resultado: dist/FinApp-x86_64.AppImage  (~172 MB)
```

### Rebuild rápido tras cambios en el frontend

Solo el frontend cambió (componentes, estilos, lógica UI):

```bash
cd frontend && nvm use 20 && npm run build
cd ../backend && uv run pyinstaller ../packaging/finapp.spec --noconfirm
cd .. && cp -r backend/dist/FinApp dist/FinApp && bash packaging/build_appimage.sh
```

### Rebuild rápido tras cambios solo en el backend

Solo el backend cambió (Python, API, modelos):

```bash
cd backend && uv run pyinstaller ../packaging/finapp.spec --noconfirm
cd .. && cp -r backend/dist/FinApp dist/FinApp && bash packaging/build_appimage.sh
```

> **Nota:** `build_appimage.sh` descarga `appimagetool` la primera vez y lo guarda en
> `dist/appimagetool-x86_64.AppImage` para reutilizarlo en builds posteriores.

### Base de datos en el AppImage

La app empaquetada guarda la base de datos en `~/.local/share/FinApp/finapp.db`
(se crea automáticamente en el primer arranque). Para usar los datos de desarrollo:

```bash
cp data/finapp.db ~/.local/share/FinApp/finapp.db   # con la app cerrada
```

## Documentación del proyecto

- **`ESPECIFICACIONES.md`** — especificación detallada (funcionalidades, pantallas, modelo de datos, fases).
- **`AGENTS.md`** — guía operativa para agentes de IA (stack, comandos, convenciones, reglas). Fuente de verdad.
- **`CLAUDE.md`** — referencia a `AGENTS.md` para Claude Code.

## Estado

Proyecto en fase inicial. Ver la hoja de ruta en `AGENTS.md`.
