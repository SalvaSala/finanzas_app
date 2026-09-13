# Sistema de diseño — FinApp

> Extraído del código existente (`frontend/src`). **Las decisiones ya están tomadas:**
> aplicarlas, no proponer una dirección nueva. Si algo nuevo no encaja, preguntar.

## Dirección

App de escritorio de finanzas personales. Sobria y neutra: el gris da la estructura y el
color solo aparece cuando significa algo (marca, ingreso, gasto, error, aviso).

## Base fija (no cambiar)

- **Componentes:** shadcn/ui, estilo `new-york`, `baseColor: neutral`, iconos `lucide`.
- **Tokens:** los nombres de shadcn (`--background`, `--card`, `--muted`...) en
  `frontend/src/index.css`. No renombrarlos; los propios se añaden al lado (`--income`, `--expense`).
- **Tipografía:** Inter Variable (fichero local en `src/assets/fonts`).
- **Modo oscuro:** clase `.dark`; todo token nuevo necesita valor claro y oscuro.

## Color

| Uso | Clase | Nota |
|---|---|---|
| Texto secundario | `text-muted-foreground` | El más usado: etiquetas, metadatos |
| Marca / acción principal | `bg-primary`, `text-primary` | Azul `#135087`, distinto de ingreso/gasto |
| Ingresos | `text-income` | Verde |
| Gastos | `text-expense` | Rojo **y con signo menos** |
| Error / borrar | `text-destructive` | |
| Aviso | `amber-500` (`border-amber-500/30 bg-amber-500/5`) | Sin token propio |
| Fondos suaves | `bg-muted/30`, `bg-muted/40`, `bg-expense/5` | Resaltados discretos |

Un solo color de acento. Sin degradados ni color decorativo.

## Profundidad

**Bordes primero** (`border` ~72 usos frente a ~9 sombras). Las tarjetas usan la `Card` de
shadcn (`rounded-xl border bg-card shadow`). Sombras solo sutiles (`shadow-xs`/`shadow-sm`).

## Radio

`--radius: 0.625rem`. `rounded-md` en controles y botones, `rounded-lg`/`rounded-xl` en
bloques y tarjetas, `rounded-full` en pastillas e indicadores.

## Espaciado (base 4px, escala de Tailwind)

- Dentro de un elemento: `gap-1`, `gap-2` (lo más común).
- Entre bloques: `gap-4`, `space-y-4`. Entre secciones: `space-y-6`.
- Página: `main` con `p-8`. Tarjetas: `p-6` (shadcn); tarjetas del dashboard `p-5`.

## Tipografía

- Cuerpo `text-sm`; metadatos `text-xs`.
- Pesos: `font-medium` en etiquetas, `font-semibold` en títulos, `font-bold` en cifras destacadas.
- **Importes siempre con `tabular-nums`**, formateados con `formatAmount` (`lib/format.ts`, `es-ES`, EUR).
- KPI: etiqueta `text-xs uppercase tracking-wide` en gris; valor `text-3xl font-bold tabular-nums`.

## Patrones

- **Layout:** barra lateral `w-52 border-r bg-card px-3 py-6`, navegación `gap-1` con icono
  `h-4 w-4`; contenido `flex-1 overflow-auto p-8`.
- **Botones:** tamaños de shadcn: `default` h-9, `sm` h-8, `xs` h-6.
- **Iconos:** `h-4 w-4` en navegación y botones, `h-3.5 w-3.5` en línea con texto, `h-3 w-3` en insignias.
- **Movimiento:** `transition-colors` en hovers; animaciones de shadcn y `fade-slide-in` (4px). Sin rebotes.
- **Gráficos (ECharts):** colores desde `useEChartsTheme()` (`hooks/useEChartsTheme.ts`).
  ECharts pinta en canvas y no lee variables CSS, por eso son valores hex.

## Incoherencias conocidas (pendientes, no copiarlas)

- La paleta de `useEChartsTheme` no coincide con los tokens: azul `#2563eb` en vez del de
  marca, y verde/rojo/grises distintos de `--income`, `--expense` y el gris neutro.
- Los avisos usan `amber-500` directo en lugar de un token `--warning`.
- La `Card` lleva `shadow`, pero los esqueletos de carga del dashboard no.
