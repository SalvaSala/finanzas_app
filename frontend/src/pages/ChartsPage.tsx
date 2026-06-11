import { useState } from "react";
import { BarChart3 } from "lucide-react";

import { useTreemap, useCalendar, useSankey } from "@/hooks/useCharts";
import { BalanceHistoryChart } from "@/components/charts/BalanceHistoryChart";
import { TreemapChart } from "@/components/charts/TreemapChart";
import { CalendarHeatmap } from "@/components/charts/CalendarHeatmap";
import { SankeyChart } from "@/components/charts/SankeyChart";
import { Separator } from "@/components/ui/separator";

const now = new Date();
const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
const MONTHS = [
  { value: undefined, label: "Año completo" },
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

function ChartCard({
  title,
  description,
  height,
  children,
}: {
  title: string;
  description?: string;
  height?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mb-4 mt-1 text-xs text-muted-foreground">{description}</p>}
      <div style={{ height: height ?? "360px" }}>{children}</div>
    </div>
  );
}

export function ChartsPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(undefined);

  const { data: treemapData, isLoading: loadingTreemap } = useTreemap(year, month);
  const { data: calendarData = [], isLoading: loadingCalendar } = useCalendar(year);
  const { data: sankeyData, isLoading: loadingSankey } = useSankey(year, month);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <BarChart3 className="mt-1 h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gráficos avanzados</h1>
          <p className="text-sm text-muted-foreground">
            Análisis visual detallado de ingresos y gastos.
          </p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={month ?? ""}
          onChange={(e) =>
            setMonth(e.target.value === "" ? undefined : Number(e.target.value))
          }
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          {MONTHS.map((m) => (
            <option key={m.value ?? "all"} value={m.value ?? ""}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <Separator />

      {/* Balance history — shown first */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Evolución del balance</h2>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">
          Balance acumulado (ingresos − gastos) a lo largo del tiempo.
        </p>
        <BalanceHistoryChart />
      </div>

      {/* Treemap */}
      <ChartCard
        title="Distribución de gastos"
        description="Treemap categoría → subcategoría. El tamaño de cada bloque representa el importe gastado."
        height="380px"
      >
        {loadingTreemap || !treemapData ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Cargando…
          </div>
        ) : (
          <TreemapChart data={treemapData} />
        )}
      </ChartCard>

      {/* Calendar heatmap */}
      <ChartCard
        title="Heatmap de gastos diarios"
        description={`Intensidad del gasto por día del año ${year}. Cuanto más oscuro, mayor gasto.`}
        height="200px"
      >
        {loadingCalendar ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Cargando…
          </div>
        ) : (
          <CalendarHeatmap data={calendarData} year={year} />
        )}
      </ChartCard>

      {/* Sankey */}
      <ChartCard
        title="Flujo ingresos → gastos"
        description="Diagrama Sankey: fuentes de ingresos (izquierda) → bolsa común → categorías de gasto (derecha)."
        height="420px"
      >
        {loadingSankey || !sankeyData ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Cargando…
          </div>
        ) : (
          <SankeyChart data={sankeyData} />
        )}
      </ChartCard>
    </div>
  );
}
