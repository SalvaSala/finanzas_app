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

## Empaquetado (instalable de escritorio)

```bash
cd frontend && npm run build       # genera frontend/dist
# luego PyInstaller (ver carpeta packaging/)
```

## Documentación del proyecto

- **`ESPECIFICACIONES.md`** — especificación detallada (funcionalidades, pantallas, modelo de datos, fases).
- **`AGENTS.md`** — guía operativa para agentes de IA (stack, comandos, convenciones, reglas). Fuente de verdad.
- **`CLAUDE.md`** — referencia a `AGENTS.md` para Claude Code.

## Estado

Proyecto en fase inicial. Ver la hoja de ruta en `AGENTS.md`.
