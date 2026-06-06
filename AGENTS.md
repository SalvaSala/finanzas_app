# AGENTS.md — FinApp (app de finanzas personales)

> Archivo **canónico** de contexto para agentes de IA (Codex, Copilot, Cursor, Windsurf, Claude Code...).
> Guía operativa del proyecto. La especificación detallada de producto está en `ESPECIFICACIONES.md`.
> Mantener este archivo actualizado a medida que avanza el proyecto.

## Resumen

App de **finanzas personales** para registrar ingresos/gastos y analizarlos en un dashboard.
- **Ahora:** app de escritorio **local**, instalable en **Windows y Linux**, con base de datos local.
- **Futuro:** backend en la nube (multiusuario, sincronización).
- **Principio rector:** el backend es el mismo en local y en nube; solo cambia el despliegue y la BD.

## Stack

**Backend (Python):** FastAPI · SQLModel (SQLAlchemy + Pydantic) · SQLite (→ PostgreSQL en nube) · Alembic · Uvicorn · pytest · ruff + black + mypy · uv.

**Frontend (TypeScript):** Vite · React · TailwindCSS v4 (config CSS-first, sin `tailwind.config.js`; plugin `@tailwindcss/vite`) · shadcn/ui · Recharts (gráficos estándar) + Nivo/visx (treemap, heatmap, Sankey) · TanStack Query · TanStack Table · React Hook Form + Zod.

**Comunicación:** API REST bajo `/api`. Tipos del frontend generados desde el esquema **OpenAPI** de FastAPI (`openapi-typescript`).

**Empaquetado local:** `vite build` → FastAPI sirve los estáticos + API en un proceso → ventana de escritorio con **pywebview** → instalable con **PyInstaller** (Windows `.exe`, Linux AppImage/`.deb`).

## Herramientas MCP

El proyecto tiene instalados tres servidores MCP a nivel de usuario:

- **Context7** — documentación actualizada de librerías. Añade **`use context7`** al
  trabajar con cualquier librería del stack (FastAPI, SQLModel, Alembic, React,
  Tailwind, shadcn/ui, Recharts, TanStack Query, TanStack Table, React Hook Form, Zod)
  para consultar la documentación al día en lugar de basarte en los datos de
  entrenamiento. Especialmente importante en **Tailwind v4 y shadcn/ui**, donde la
  sintaxis cambia respecto a versiones anteriores.
- **GitHub** — gestión del repositorio (issues, PRs, búsqueda de código). Úsalo cuando
  necesites interactuar con el repo desde el agente.
- **Playwright** — pruebas visuales del frontend. Úsalo para verificar que las
  pantallas se ven y se comportan correctamente abriendo un navegador real.

## Comandos

> Dos mundos: `backend/` (Python) y `frontend/` (Node). Se trabaja con **dos terminales** en desarrollo.

**Backend** (desde `backend/`):
```bash
uv sync                                  # instalar dependencias
uv run uvicorn app.main:app --reload     # arrancar API en desarrollo
uv run pytest                            # tests
uv run ruff check . && uv run black .    # lint + formato
uv run mypy .                            # comprobación de tipos
uv run alembic revision --autogenerate -m "msg"   # crear migración
uv run alembic upgrade head              # aplicar migraciones
```

**Frontend** (desde `frontend/`):
```bash
npm install                              # instalar dependencias
npm run dev                              # arrancar UI en desarrollo (Vite)
npm run build                            # compilar a estáticos (frontend/dist)
npm run lint                             # ESLint
npm run gen:api                          # regenerar tipos TS desde OpenAPI
```

**Empaquetado** (desde la raíz):
```bash
# 1) npm run build (frontend)  2) PyInstaller con frontend/dist incluido
# Ver packaging/ para el spec concreto por plataforma.
```

## Estructura del repositorio

```
finapp/
├── AGENTS.md            # este archivo (canónico)
├── CLAUDE.md            # referencia a AGENTS.md (para Claude Code)
├── ESPECIFICACIONES.md  # spec detallada de producto
├── README.md
├── backend/   app/{core,models,schemas,repositories,services,api} + alembic/ + tests/
├── frontend/  src/{api,hooks,components,pages,lib,theme}
├── data/      finapp.db (SQLite local)
└── packaging/ specs PyInstaller/pywebview
```

## Convenciones de código

- **Idioma:** código (clases, variables, funciones) en **inglés**; textos de interfaz en **español**.
- **Dinero:** usar `Decimal` en backend; en frontend manejar céntimos como enteros o librería decimal, formatear al mostrar. **Nunca `float` para importes.**
- **Backend:** ruff + black + mypy obligatorios. Tipado en funciones públicas.
- **Frontend:** ESLint + Prettier. TypeScript estricto. Exports con nombre (no default).
- **Importe en UI:** gastos en **rojo con signo menos**, ingresos en **verde**.
- **Locale por defecto:** `es-ES`, moneda `EUR`.

## Reglas de arquitectura

- La **lógica de negocio** (KPIs, agregaciones, validaciones) vive en `backend/app/services/`. **Nunca** en el frontend.
- El acceso a datos pasa **solo** por `repositories/`.
- El frontend **consume la API REST** y no contiene lógica de negocio: solo presenta y captura.
- Las **agregaciones** (sumas por categoría/periodo) se hacen en la BD, no en Python ni en el navegador.
- Modelar pensando en la nube: tener en mente un futuro `user_id`; mantener el backend agnóstico de la BD.

## Empaquetado (ganchos a respetar desde la Fase 1)

Aunque el instalable se construye al final, el código debe contemplar esto desde el inicio
para no refactorizar después (detalle en `packaging/README.md`):
- `app/main.py` debe poder **servir el frontend compilado** (`frontend/dist`) en producción, con la API bajo `/api`.
- Centralizar en `app/core/paths.py` la **resolución de rutas** (desarrollo vs empaquetado, vía `sys._MEIPASS`) y la **ubicación de la base de datos** en la carpeta de datos del usuario del SO.
- Aplicar **migraciones Alembic en el primer arranque**.
- Punto de entrada de escritorio (FastAPI + pywebview) en `packaging/desktop.py`.
- La CI (`.github/workflows/build.yml`) construye los instalables en Windows y Linux al publicar una release.

## Boundaries (qué hacer / preguntar / no hacer)

**Siempre:**
- Ejecutar lint, formato y tests antes de dar por terminada una tarea.
- Regenerar los tipos TS del frontend (`npm run gen:api`) cuando cambie la API.
- Crear migración Alembic cuando cambie el modelo de datos.
- Tras actualizar dependencias, regenerar el instalable y probarlo (no solo el modo desarrollo).
- Commitear directamente en main (proyecto monousuario; se revisará cuando haya colaboradores).

**Preguntar antes de:**
- Añadir dependencias pesadas o cambiar piezas del stack.
- Cambios que afecten al modelo de datos ya existente (migraciones destructivas).

**Nunca:**
- Usar `float` para dinero.
- Meter lógica de negocio en el frontend ni saltarse la capa `services/`/`repositories/`.
- Romper la separación backend/frontend pensando en la futura nube.
- Dejar los tipos del frontend desincronizados con la API.

## Hoja de ruta (marcar lo completado)

- [ ] **Fase 1 (MVP):** andamiaje, modelo + migración, datos semilla, CRUD movimientos, dashboard (KPIs + donut + tabla), selector año/mes.
- [ ] **Fase 2:** transferencias, presupuestos, filtros/búsqueda, import/export CSV, gráficos adicionales.
- [ ] **Fase 3:** recurrentes, etiquetas, objetivos de ahorro, reglas de autocategorización, modo oscuro, informes PDF, backup/restore, gráficos avanzados.
- [ ] **Fase 4 (nube):** auth/multiusuario, PostgreSQL, despliegue, sincronización.

## Referencias

- Detalle de funcionalidades, pantallas y modelo de datos: **`ESPECIFICACIONES.md`**.
