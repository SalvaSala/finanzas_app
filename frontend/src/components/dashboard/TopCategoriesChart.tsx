import { useMemo, useState } from "react";
import type { CategoryAmount } from "@/api/client";
import { EChart } from "@/components/charts/EChart";
import type { EChartsCoreOption } from "@/lib/echarts";
import { useEChartsTheme, tooltipStyle } from "@/hooks/useEChartsTheme";

const FALLBACK = [
  "#6366f1","#f97316","#14b8a6","#f43f5e","#8b5cf6",
  "#eab308","#06b6d4","#84cc16","#ec4899","#64748b",
];

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

type TxType = "expense" | "income";

interface ChartItem {
  name: string;
  value: number;
  color: string;
}

interface Props {
  expenseData: CategoryAmount[];
  incomeData: CategoryAmount[];
}

export function TopCategoriesChart({ expenseData, incomeData }: Props) {
  const [type, setType] = useState<TxType>("expense");
  const palette = useEChartsTheme();

  const rawData = type === "expense" ? expenseData : incomeData;

  const chartData: ChartItem[] = useMemo(
    () =>
      [...rawData]
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
        .slice(0, 10)
        .map((item, i) => ({
          name: item.icon ? `${item.icon} ${item.name}` : item.name,
          value: parseFloat(item.total),
          color: item.color ?? FALLBACK[i % FALLBACK.length],
        })),
    [rawData],
  );

  const chartHeight = Math.max(chartData.length * 36 + 10, 80);

  const option = useMemo<EChartsCoreOption>(
    () => ({
      grid: { top: 0, right: 90, bottom: 0, left: 0, containLabel: true },
      xAxis: { type: "value", show: false },
      yAxis: {
        type: "category",
        // Orden inverso: la categoría de mayor importe arriba
        data: chartData.map((d) => d.name).reverse(),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { fontSize: 12, color: palette.text },
      },
      tooltip: {
        trigger: "item",
        ...tooltipStyle(palette),
        formatter: (params: unknown) => {
          const p = params as { dataIndex: number };
          const item = [...chartData].reverse()[p.dataIndex];
          if (!item) return "";
          return (
            `<div style="display:flex;align-items:center;gap:8px">` +
            `<span style="width:8px;height:8px;border-radius:50%;background:${item.color};flex-shrink:0"></span>` +
            `<span style="font-weight:500">${item.name}</span></div>` +
            `<p style="margin:2px 0 0;color:${palette.tick}">${EUR.format(item.value)}</p>`
          );
        },
      },
      series: [
        {
          type: "bar",
          data: [...chartData]
            .reverse()
            .map((d) => ({ value: d.value, itemStyle: { color: d.color, borderRadius: [0, 4, 4, 0] } })),
          barCategoryGap: "30%",
          label: {
            show: true,
            position: "right",
            distance: 6,
            fontSize: 11,
            color: palette.text,
            formatter: ({ value }: { value: number }) => EUR.format(value),
          },
        },
      ],
    }),
    [chartData, palette],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Top categorías</h3>
          <p className="text-xs text-muted-foreground">Mayores importes del periodo</p>
        </div>
        <div className="flex gap-1 rounded-md border bg-muted p-0.5">
          {(["expense", "income"] as TxType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                type === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "expense" ? "Gastos" : "Ingresos"}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin datos para este periodo
        </p>
      ) : (
        <div style={{ height: chartHeight }}>
          <EChart option={option} />
        </div>
      )}
    </div>
  );
}
