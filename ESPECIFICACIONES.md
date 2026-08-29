# Especificaciones — App de Finanzas Personales ("FinApp")

> Documento de especificaciones para desarrollar el proyecto con **Claude Code**.
> A partir de este documento, Claude Code debe generar el archivo `CLAUDE.md` del repositorio
> (ver sección 12) y comenzar el desarrollo por fases.

---

## 1. Visión y objetivos

Aplicación de **finanzas personales** para registrar y analizar ingresos y gastos.

- **Fase inicial:** aplicación de escritorio **local**, instalable en **Windows y Linux**, sin conexión a internet, con base de datos local.
- **Fase futura:** backend en la nube con cuentas de usuario, sincronización y acceso multidispositivo.
- **Principios:** el backend (lógica + datos) es el mismo en local y en la nube; lo único que cambia es dónde se despliega y la base de datos. Esto evita reescribir al migrar.

**No-objetivos (de momento):** app móvil nativa, conexión bancaria automática (PSD2/open banking), multiusuario en local.

---

## 2. Arquitectura y stack

Arquitectura **frontend / backend separados**, comunicándose por una **API REST** (HTTP/JSON).

### Backend (Python)
| Capa | Tecnología | Motivo |
|---|---|---|
| API | **FastAPI** | Estándar moderno en Python; valida datos por tipos y genera OpenAPI. Migra a la nube sin tocar la lógica. |
| ORM / Modelos | **SQLModel** (sobre SQLAlchemy + Pydantic) | Modelo definido una vez, reutilizable en BD y validación de API. |
| Base de datos | **SQLite** (local) → **PostgreSQL** (nube) | Solo cambia la cadena de conexión. |
| Migraciones | **Alembic** | Evolución del esquema controlada. |
| Servidor | **Uvicorn** | Servidor ASGI para FastAPI. |
| Tests | **pytest** | Cobertura de la lógica de negocio. |
| Calidad | **ruff** + **black** + **mypy** | Linter, formato y tipado. |
| Dependencias | **uv** (o Poetry) | Entornos reproducibles. |

### Frontend (JavaScript/TypeScript — Opción B)
| Capa | Tecnología | Motivo |
|---|---|---|
| Build / dev server | **Vite** | Arranque y recarga muy rápidos. |
| Lenguaje | **TypeScript** | Tipado fuerte, menos errores. |
| Librería UI | **React** | Ecosistema enorme; Claude Code lo genera muy bien. |
| Estilos | **TailwindCSS v4** (config CSS-first, plugin `@tailwindcss/vite`) | Estilado rápido y consistente. |
| Componentes | **shadcn/ui** (Radix + Tailwind) | Componentes accesibles y con muy buen aspecto. |
| Gráficos | **Apache ECharts** (bar, line/area, pie, treemap, calendar heatmap, sankey) | Una sola librería con tree-shaking; wrapper en `components/charts/EChart.tsx`. |
| Estado servidor | **TanStack Query (React Query)** | Caché, recarga y sincronización de datos de la API. |
| Cliente HTTP | **fetch**/**axios** + tipos generados desde OpenAPI | Llamadas a la API tipadas. |
| Tablas | **TanStack Table** | Tabla de movimientos con orden, filtro y edición. |
| Formularios | **React Hook Form** + **Zod** | Formularios validados. |

### Comunicación frontend ↔ backend
- El backend expone endpoints REST bajo `/api`.
- En **desarrollo**: Vite corre en un puerto y FastAPI en otro; se usa **proxy de Vite** (o **CORS**) para que el frontend hable con la API.
- **Tipos sincronizados:** FastAPI genera automáticamente un esquema **OpenAPI**; el frontend genera sus tipos TypeScript desde ahí con **openapi-typescript**, de modo que backend y frontend nunca se desincronizan.

**Regla de oro:** toda la lógica de negocio (cálculo de KPIs, agregaciones, validaciones) vive en el backend (`services/`). El frontend **solo presenta y captura**.

---

## 3. Estructura del proyecto

Monorepo con backend y frontend separados:

```
finapp/
├── CLAUDE.md                 # generado por Claude Code (ver sección 12)
├── README.md
├── backend/
│   ├── pyproject.toml
│   ├── alembic/              # migraciones
│   ├── app/
│   │   ├── main.py           # arranque FastAPI + montaje estáticos en producción
│   │   ├── core/             # config, conexión BD, settings
│   │   ├── models/           # modelos SQLModel (sección 4)
│   │   ├── schemas/          # DTOs Pydantic (entrada/salida API)
│   │   ├── repositories/     # acceso a datos
│   │   ├── services/         # lógica de negocio (KPIs, agregaciones)
│   │   └── api/              # routers/endpoints REST (/api/...)
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts        # incluye el plugin @tailwindcss/vite (Tailwind v4)
│   ├── components.json       # configuración de shadcn/ui
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css         # config CSS-first de Tailwind v4 (@import "tailwindcss")
│       ├── api/              # cliente HTTP + tipos generados de OpenAPI
│       ├── hooks/            # hooks de React Query (useTransactions, useKpis...)
│       ├── components/
│       │   ├── ui/           # componentes shadcn/ui
│       │   ├── KpiCard.tsx
│       │   ├── ChartCard.tsx
│       │   ├── TransactionTable.tsx
│       │   └── TransactionForm.tsx
│       ├── pages/            # Dashboard, Transactions, Budgets, Settings
│       ├── lib/              # utils: formato moneda/fecha, helpers
│       └── theme/            # tokens de diseño, modo claro/oscuro
├── data/
│   └── finapp.db             # SQLite local
└── packaging/                # specs PyInstaller / pywebview
```

---

## 4. Modelo de datos

Entidades principales. Las **subcategorías** se modelan como categorías con `parent_id` (auto-referencia), lo que simplifica el esquema. Nombres de modelos/campos **en inglés**.

### `Account` (Cuenta)
| Campo | Tipo | Notas |
|---|---|---|
| id | int (PK) | |
| name | str | "Banco principal", "Efectivo", "Tarjeta" |
| type | enum | `cash` / `bank` / `card` / `savings` |
| currency | str | ISO 4217, por defecto `EUR` |
| initial_balance | decimal | saldo de apertura |
| archived | bool | ocultar sin borrar |

### `Category` (Categoría / Subcategoría)
| Campo | Tipo | Notas |
|---|---|---|
| id | int (PK) | |
| name | str | |
| type | enum | `income` / `expense` |
| parent_id | int (FK, nullable) | si tiene valor → es subcategoría |
| color | str | hex, para gráficos |
| icon | str | nombre de icono (opcional) |

### `Transaction` (Movimiento)
| Campo | Tipo | Notas |
|---|---|---|
| id | int (PK) | |
| date | date | |
| type | enum | `income` / `expense` / `transfer` |
| concept | str | descripción corta |
| description | str (nullable) | descripción extensa |
| amount | decimal | **siempre positivo**; el signo lo determina `type` |
| category_id | int (FK, nullable) | |
| subcategory_id | int (FK, nullable) | |
| account_id | int (FK) | cuenta origen |
| transfer_account_id | int (FK, nullable) | cuenta destino (solo `transfer`) |
| recurring_id | int (FK, nullable) | si proviene de una recurrencia |
| created_at | datetime | |

### `Tag` (Etiqueta) — relación N:M con `Transaction`
Etiquetas libres transversales a categorías (p. ej. "vacaciones", "deducible").

### `Budget` (Presupuesto)
| Campo | Tipo | Notas |
|---|---|---|
| id | int (PK) | |
| category_id | int (FK) | |
| amount | decimal | límite |
| period | enum | `monthly` / `yearly` |

### `RecurringTransaction` (Recurrente)
Plantilla de movimiento + frecuencia (`daily`/`weekly`/`monthly`/`yearly`) + fecha inicio/fin. Un proceso genera los movimientos correspondientes.

### `SavingsGoal` (Objetivo de ahorro)
| Campo | Tipo | Notas |
|---|---|---|
| id | int (PK) | |
| name | str | |
| target_amount | decimal | |
| current_amount | decimal | |
| deadline | date (nullable) | |

### `CategorizationRule` (Regla de autocategorización)
Si el `concept` contiene cierto texto → asignar categoría/subcategoría automáticamente al introducir un movimiento.

**Convención de importes:** `amount` se guarda siempre positivo. En la UI, gastos en **rojo con signo menos**, ingresos en **verde**. Usar `Decimal` (nunca `float`) para evitar errores de redondeo monetario.

---

## 5. Funcionalidades por fases

### Fase 1 — MVP
- CRUD de **cuentas** y **categorías/subcategorías** (con datos semilla iniciales).
- CRUD de **movimientos** (ingresos y gastos) mediante formulario.
- **Dashboard** con KPIs, gráfico donut y tabla de últimos movimientos.
- Selector de periodo: **año en curso** ↔ **mes en curso** (global al dashboard).
- Persistencia en SQLite + migraciones Alembic.

### Fase 2
- **Transferencias** entre cuentas.
- **Presupuestos** por categoría con barra de progreso y alerta al superarse.
- **Filtros y búsqueda** de movimientos (fecha, categoría, cuenta, texto, etiqueta).
- **Importación / exportación CSV**.
- Gráficos adicionales (barras mensuales ingresos vs gastos, evolución del balance).

### Fase 3
- **Movimientos recurrentes**.
- **Etiquetas**.
- **Objetivos de ahorro**.
- **Reglas de autocategorización**.
- **Modo oscuro**, **informes PDF**, **copia de seguridad/restauración** de la BD.
- Gráficos avanzados (treemap, heatmap de calendario, Sankey).

### Fase 4 — Nube
- Autenticación y multiusuario, PostgreSQL, despliegue y sincronización (ver sección 10).
- Otras ideas futuras: **multidivisa**, **adjuntar comprobantes/facturas**, **comparativa interanual**, **patrimonio neto** (activos/deudas).

---

## 6. Detalle de las pantallas

### 6.1 Dashboard principal

Selector global de periodo en la cabecera: **Año en curso** / **Mes en curso** (afecta a todos los widgets).

**A) Fila de KPIs** (3 tarjetas):
- **Ingresos** acumulados del periodo (verde).
- **Gastos** acumulados del periodo (rojo).
- **Balance** (ingresos − gastos), color según signo.
- Cada tarjeta muestra opcionalmente la **variación %** respecto al periodo anterior.

**B) Sección de gráficos:**
- **Donut de gastos por categoría**, con *drill-down* a **subcategoría** al hacer clic en un segmento (total en el centro).
- **Donut de ingresos por categoría** (misma mecánica).
- **Barras apiladas** ingresos vs gastos por mes.
- **Línea/área** de evolución del balance acumulado.
- **Barras horizontales** con el top de mayores gastos del periodo.
- (Fase 3) **Treemap** categoría→subcategoría, **heatmap** de calendario de gasto diario, **Sankey** de flujo ingresos→gastos.

**C) Tabla de últimos movimientos:**
- Resumen de los últimos N movimientos (p. ej. 10).
- Columnas: `Fecha · Concepto · Categoría · Cuenta · Importe`.
- Importe con color/signo según convención. Enlace a la pestaña de movimientos.

### 6.2 Pestaña de introducción de datos (movimientos)

**Formulario** (React Hook Form + Zod) con los campos:
1. **Fecha** (por defecto hoy).
2. **Tipo** (ingreso / gasto / transferencia).
3. **Concepto** (descripción corta, con autocompletado de históricos).
4. **Categoría** (filtrada según tipo).
5. **Subcategoría** (filtrada según categoría).
6. **Cuenta** (origen; si es transferencia, también cuenta destino).
7. **Importe** (positivo; el tipo determina el signo y el color).
8. **Descripción** (texto largo, opcional).

**Tabla de movimientos** (TanStack Table) debajo, orden de columnas recomendado:

`Fecha · Tipo · Concepto · Categoría · Subcategoría · Cuenta · Importe · Acciones`

- La **descripción larga** no es columna fija: tooltip al pasar el ratón o fila expandible.
- **Importe:** gastos en **rojo con signo menos**, ingresos en **verde**.

**Funcionalidades de la pestaña:**
- Autocompletado del concepto y memoria de la última categoría usada.
- **Duplicar** movimiento, **editar en línea**, **borrar** con confirmación.
- Marcar un movimiento como **recurrente** desde el formulario.
- **Validaciones**: importe > 0, fecha válida, categoría coherente con el tipo.
- **Atajos de teclado** para entrada rápida (guardar y crear otro).
- **Filtros** por fecha/categoría/cuenta/etiqueta/texto sobre la tabla.
- **Importación CSV** con previsualización y mapeo de columnas.

---

## 7. Diseño UI/UX

- Interfaz tipo dashboard moderno, limpia y con buena jerarquía visual (shadcn/ui + Tailwind).
- **Tokens de diseño** centralizados (colores, espaciado, tipografía) en `src/theme/` y variables CSS de Tailwind.
- **Modo claro y oscuro**.
- Paleta semántica fija: **verde** = ingresos/positivo, **rojo** = gastos/negativo, neutro para el resto.
- Componentes reutilizables: `KpiCard`, `ChartCard`, `TransactionTable`, `TransactionForm`.
- Layout **responsive** dentro de la ventana de escritorio.
- Formato de moneda y fechas según locale (por defecto `es-ES`, `EUR`).
- Estados vacíos y de carga cuidados (skeletons mientras React Query trae datos).

---

## 8. Requisitos no funcionales

- **Rendimiento:** dashboard fluido con miles de movimientos (agregaciones en BD, no en Python ni en el navegador).
- **Integridad monetaria:** `Decimal` en backend; en frontend, manejar importes con cuidado (enteros de céntimos o librería decimal) y formatear al mostrar.
- **Persistencia segura:** base de datos local en la ruta de datos de usuario estándar del SO.
- **Internacionalización:** textos de UI centralizados para traducir en el futuro.
- **Tests:** la capa de servicios (KPIs y agregaciones) con tests unitarios; tests de endpoints clave.
- **Logging** básico de errores en backend.

---

## 9. Empaquetado y distribución (local)

El reto de la Opción B es empaquetar un frontend web + backend Python como app de escritorio. Enfoque recomendado (mantiene la distribución dirigida por Python):

1. **Compilar el frontend:** `vite build` genera estáticos en `frontend/dist`.
2. **Servir desde FastAPI:** en producción, FastAPI sirve esos estáticos (StaticFiles) **y** la API en el mismo proceso → no hay CORS ni dos servidores.
3. **Ventana de escritorio:** usar **pywebview** para abrir una ventana nativa que apunta al servidor local de FastAPI (en vez de un navegador).
4. **Instalable:** empaquetar con **PyInstaller** (incluyendo `frontend/dist`) → `.exe`/instalador en Windows y **AppImage**/`.deb` en Linux.
5. En el **primer arranque**, crear la base de datos y aplicar migraciones automáticamente.

**Dependencias de la ventana según plataforma.** pywebview usa un motor distinto en
cada sistema: en **Windows**, EdgeChromium (ya presente en el SO); en **Linux**,
GTK/WebKit a través de **PyGObject**, que hay que instalar en el entorno de
construcción (grupo `packaging` de `pyproject.toml`) junto a las cabeceras del
sistema `libgirepository1.0-dev`, `libcairo2-dev` y `gir1.2-webkit2-4.0`.

> **Riesgo a tener presente:** si falta PyGObject, el instalable **se genera sin
> errores y su servidor interno arranca**, pero la ventana nunca aparece. Por eso
> la comprobación de un instalable no puede limitarse a "responde el servidor":
> hay que abrirlo. La lista completa de verificación está en `packaging/README.md`.

**Recursos que deben viajar dentro del paquete.** Todo lo que el backend abre por
ruta de fichero hay que declararlo en `packaging/finapp.spec`: el frontend
compilado, las migraciones de Alembic, las **fuentes DejaVu** del informe PDF y los
typelibs de GTK en Linux. Si falta alguno, el binario se construye bien y falla al
usarse (p. ej. el PDF devolviendo un error 500).

**Alternativas de empaquetado** (si se busca algo más nativo): **Tauri** (ligero, requiere toolchain de Rust) o **Electron** (más pesado). Ambos lanzarían el backend FastAPI como sidecar.

---

## 10. Migración futura a la nube (preparar el terreno desde ya)

- Backend agnóstico de la BD: SQLite → PostgreSQL solo cambia la cadena de conexión.
- Diseñar el modelo con un futuro campo `user_id` en mente (multiusuario).
- Endpoints ya pensados para autenticación (Fase 4: JWT/OAuth).
- En la nube, el frontend React se despliega como sitio estático (CDN) o servido por el backend; en local va empaquetado. **El mismo código de frontend sirve para ambos.**
- Estrategia de **sincronización** local↔nube a definir en Fase 4 (timestamps `updated_at`, resolución de conflictos).

---

## 11. Plan de trabajo sugerido para Claude Code

Iterar en este orden, validando cada paso:
1. Andamiaje del monorepo: `backend/` (FastAPI + pyproject) y `frontend/` (Vite + React + TS + Tailwind + shadcn/ui).
2. Configuración de BD, modelos SQLModel y migración inicial Alembic.
3. Datos semilla (cuentas y categorías por defecto).
4. Capa de servicios + endpoints REST de movimientos y KPIs (con tests).
5. Generación de tipos TypeScript desde OpenAPI + cliente API + hooks de React Query.
6. Pestaña de introducción de datos (formulario + tabla).
7. Dashboard (KPIs + donut + tabla de últimos movimientos) con selector de periodo.
8. Gráficos adicionales.
9. Resto de funcionalidades por fases.
10. Empaquetado para Windows y Linux (FastAPI sirve estáticos + pywebview + PyInstaller).

---

## 12. Archivos de contexto para agentes (`AGENTS.md` y `CLAUDE.md`)

El repositorio incluye dos archivos de contexto que **ya están creados** junto a este documento:

- **`AGENTS.md`** — archivo **canónico** que leen la mayoría de agentes (Codex, Copilot, Cursor, Windsurf...). Contiene resumen, stack, estructura, comandos, convenciones y reglas. Es la **fuente de verdad**.
- **`CLAUDE.md`** — archivo que usa **Claude Code**; simplemente referencia a `AGENTS.md` para no duplicar contenido.

**Indicaciones para Claude Code:**
- Trata `AGENTS.md` como la guía operativa permanente del proyecto y **mantenlo actualizado** a medida que avances (especialmente la hoja de ruta y los comandos).
- Si cambias el contenido, edita siempre `AGENTS.md` (no `CLAUDE.md`).
- Este documento (`ESPECIFICACIONES.md`) es la referencia detallada de producto (funcionalidades, pantallas, modelo de datos); `AGENTS.md` apunta a él para el detalle.
