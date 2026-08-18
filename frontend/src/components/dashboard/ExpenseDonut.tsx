import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";

import { api } from "@/api/client";
import type { CategoryAmount, CategoryAvgRow } from "@/api/client";
import { Button } from "@/components/ui/button";
import { EChart } from "@/components/charts/EChart";
import type { EChartsCoreOption } from "@/lib/echarts";
import { useEChartsTheme, tooltipStyle } from "@/hooks/useEChartsTheme";

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
  icon: string | null;
}

interface Props {
  data: CategoryAmount[];
  year: number;
  month?: number;
  title?: string;
  type?: "expense" | "income";
  averages?: CategoryAvgRow[];
}

function DonutView({
  items,
  title,
  onDrill,
  onBack,
  avgMap,
  type,
}: {
  items: ChartEntry[];
  title: string;
  onDrill?: (entry: ChartEntry) => void;
  onBack?: () => void;
  avgMap?: Map<number, CategoryAvgRow>;
  type?: "expense" | "income";
}) {
  const palette = useEChartsTheme();
  const total = items.reduce((s, d) => s + d.value, 0);

  const option = useMemo<EChartsCoreOption>(
    () => ({
      tooltip: {
        trigger: "item",
        ...tooltipStyle(palette),
        formatter: (params: unknown) => {
          const p = params as { data: ChartEntry; percent: number };
          const entry = p.data;
          const avg = entry.categoryId != null ? avgMap?.get(entry.categoryId) : undefined;
          const changePct = avg?.change_pct ?? null;
          const isGood =
            changePct === null ? null : type === "expense" ? changePct < 0 : changePct > 0;
          const changeColor =
            isGood === null ? "" : isGood ? palette.income : palette.expense;

          let html =
            `<p style="margin:0;font-weight:500">${entry.icon ? entry.icon + " " : ""}${entry.name}</p>` +
            `<p style="margin:0;color:${palette.tick}">${EUR.format(entry.value)} · ${p.percent.toFixed(1)}%</p>`;
          if (avg) {
            html += `<p style="margin:4px 0 0;font-size:11px;color:${palette.tick}">Promedio mensual: ${EUR.format(avg.avg_monthly)}`;
            if (changePct !== null) {
              html += `<span style="margin-left:6px;font-weight:500;color:${changeColor}">${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%</span>`;
            }
            html += `</p>`;
          }
          return html;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["50%", "85%"],
          center: ["50%", "50%"],
          padAngle: 2,
          cursor: onDrill ? "pointer" : "default",
          label: { show: false },
          emphasis: { scale: true, scaleSize: 4 },
          data: items.map((d) => ({
            ...d,
            itemStyle: { color: d.color },
          })),
        },
      ],
    }),
    [items, palette, avgMap, type, onDrill],
  );

  const events = useMemo(
    () =>
      onDrill
        ? {
            click: (params: unknown) => {
              const i = (params as { dataIndex: number }).dataIndex;
              const entry = items[i];
              if (entry) onDrill(entry);
            },
          }
        : undefined,
    [items, onDrill],
  );

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

      <div style={{ height: 240 }}>
        <EChart option={option} onEvents={events} />
      </div>

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
              <span className="flex-1 truncate">
                {entry.icon && <span className="mr-1">{entry.icon}</span>}
                {entry.name}
              </span>
              <span className="tabular-nums text-muted-foreground">{pct}%</span>
              <span className="tabular-nums font-medium">{EUR.format(entry.value)}</span>
            </li>
          );
        })}
      </ul>

      {onDrill && items.length > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Clic en un segmento para ver subcategorías
        </p>
      )}
    </div>
  );
}

export function ExpenseDonut({
  data,
  year,
  month,
  title = "Gastos por categoría",
  type = "expense",
  averages,
}: Props) {
  const [drilled, setDrilled] = useState<{ id: number; name: string } | null>(null);

  const avgMap = averages
    ? new Map(averages.map((r) => [r.category_id, r]))
    : undefined;

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ["dashboard", "category-breakdown", drilled?.id, year, month, type],
    queryFn: () => api.dashboard.categoryBreakdown(drilled!.id, year, month, type),
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
    icon: item.icon,
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
        icon: item.icon,
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
        type={type}
      />
    );
  }

  // Top-level view — segments are clickable only if the category has an id
  return (
    <DonutView
      items={topItems}
      title={title}
      type={type}
      avgMap={avgMap}
      onDrill={(entry) => {
        if (entry.categoryId !== null) {
          setDrilled({ id: entry.categoryId, name: entry.name });
        }
      }}
    />
  );
}
