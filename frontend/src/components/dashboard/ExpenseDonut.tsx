import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Sector } from "recharts";
import type { PieSectorShapeProps } from "recharts";

import { api } from "@/api/client";
import type { CategoryAmount } from "@/api/client";
import { Button } from "@/components/ui/button";

const FALLBACK = [
  "#6366f1","#f97316","#14b8a6","#f43f5e","#8b5cf6",
  "#eab308","#06b6d4","#84cc16","#ec4899","#64748b",
];

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

interface ChartEntry {
  name: string;
  value: number;
  color: string;
  categoryId: number | null;
}

interface Props {
  data: CategoryAmount[];
  year: number;
  month?: number;
  title?: string;
}

function makeSectorShape(chartData: ChartEntry[], clickable: boolean) {
  return function ColoredSector(props: PieSectorShapeProps) {
    const color = chartData[props.index]?.color ?? "#888";
    return (
      <Sector
        {...props}
        fill={color}
        style={clickable ? { cursor: "pointer" } : undefined}
      />
    );
  };
}

function CustomTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload: ChartEntry }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow">
      <p className="font-medium">{entry.name}</p>
      <p className="text-muted-foreground">
        {EUR.format(entry.value)} · {pct}%
      </p>
    </div>
  );
}

function DonutView({
  items,
  title,
  onDrill,
  onBack,
}: {
  items: ChartEntry[];
  title: string;
  onDrill?: (entry: ChartEntry) => void;
  onBack?: () => void;
}) {
  const total = items.reduce((s, d) => s + d.value, 0);
  const clickable = Boolean(onDrill);
  const sectorShape = makeSectorShape(items, clickable);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="80%"
            paddingAngle={2}
            shape={sectorShape}
            onClick={
              onDrill
                ? (_data, index) => {
                    const entry = items[index];
                    if (entry) onDrill(entry);
                  }
                : undefined
            }
          />
          <Tooltip content={<CustomTooltip total={total} />} />
        </PieChart>
      </ResponsiveContainer>

      <ul className="mt-3 space-y-1.5 overflow-y-auto text-sm">
        {items.map((entry) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
          return (
            <li
              key={entry.name}
              className={
                onDrill
                  ? "flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent"
                  : "flex items-center gap-2"
              }
              onClick={() => onDrill?.(entry)}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="flex-1 truncate">{entry.name}</span>
              <span className="tabular-nums text-muted-foreground">{pct}%</span>
              <span className="tabular-nums font-medium">{EUR.format(entry.value)}</span>
            </li>
          );
        })}
      </ul>

      {onDrill && items.length > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Haz clic en un segmento para ver subcategorías
        </p>
      )}
    </div>
  );
}

export function ExpenseDonut({ data, year, month, title = "Gastos por categoría" }: Props) {
  const [drilled, setDrilled] = useState<{ id: number; name: string } | null>(null);

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ["dashboard", "category-breakdown", drilled?.id, year, month],
    queryFn: () => api.dashboard.categoryBreakdown(drilled!.id, year, month),
    enabled: drilled !== null,
  });

  if (data.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <p className="mb-4 text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Sin datos para este periodo
        </div>
      </div>
    );
  }

  const topItems: ChartEntry[] = data.map((item, i) => ({
    name: item.name,
    value: parseFloat(item.total),
    color: item.color ?? FALLBACK[i % FALLBACK.length],
    categoryId: item.category_id,
  }));

  // Drill-down view
  if (drilled !== null) {
    if (subLoading) {
      return (
        <div className="flex h-full flex-col">
          <div className="mb-2 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDrilled(null)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-medium text-muted-foreground">{drilled.name}</p>
          </div>
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Cargando…
          </div>
        </div>
      );
    }

    const subItems: ChartEntry[] =
      subData?.map((item, i) => ({
        name: item.name,
        value: parseFloat(item.total),
        color: item.color ?? FALLBACK[i % FALLBACK.length],
        categoryId: item.category_id,
      })) ?? [];

    if (subItems.length === 0) {
      return (
        <div className="flex h-full flex-col">
          <div className="mb-2 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDrilled(null)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-medium text-muted-foreground">{drilled.name}</p>
          </div>
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Esta categoría no tiene subcategorías
          </div>
        </div>
      );
    }

    return (
      <DonutView
        items={subItems}
        title={drilled.name}
        onBack={() => setDrilled(null)}
      />
    );
  }

  // Top-level view — segments are clickable only if the category has an id
  return (
    <DonutView
      items={topItems}
      title={title}
      onDrill={(entry) => {
        if (entry.categoryId !== null) {
          setDrilled({ id: entry.categoryId, name: entry.name });
        }
      }}
    />
  );
}
