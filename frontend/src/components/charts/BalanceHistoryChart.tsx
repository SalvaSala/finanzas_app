import { useState, useMemo } from "react";

import { cn } from "@/lib/utils";
import { useBalanceHistory } from "@/hooks/useCharts";
import { EChart } from "@/components/charts/EChart";
import type { EChartsCoreOption } from "@/lib/echarts";
import { useEChartsTheme, tooltipStyle } from "@/hooks/useEChartsTheme";

type Period = "1M" | "3M" | "1A" | "5A";

const PERIODS: { label: string; value: Period }[] = [
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "1A", value: "1A" },
  { label: "5A", value: "5A" },
];

/** Muestra 1 etiqueta de cada N en periodos cortos; en largos, modo automático. */
function labelStep(period: Period, dataLen: number): number | null {
  if (period === "1M") return Math.max(1, Math.floor(dataLen / 6));
  if (period === "3M") return Math.max(1, Math.floor(dataLen / 8));
  return null;
}

function formatXTick(dateStr: string, period: Period): string {
  const d = new Date(dateStr + "T00:00:00");
  if (period === "1M" || period === "3M") {
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }
  return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
}

function formatTooltipLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr + "T00:00:00");
  if (period === "1M" || period === "3M") {
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  }
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

export function BalanceHistoryChart() {
  const [period, setPeriod] = useState<Period>("1A");
  const { data = [], isLoading } = useBalanceHistory(period);
  const palette = useEChartsTheme();

  const option = useMemo<EChartsCoreOption>(() => {
    const dates = data.map((d) => d.date);
    const balances = data.map((d) => d.balance);
    const min = balances.length ? Math.min(...balances) : 0;
    const max = balances.length ? Math.max(...balances) : 0;
    const hasMixed = min < 0 && max > 0;
    const allNeg = max <= 0;

    // Sin cruce de cero: color único. Con cruce: visualMap colorea por tramos.
    const singleColor = allNeg ? palette.expense : palette.income;
    const step = labelStep(period, data.length);

    return {
      grid: { top: 8, right: 8, bottom: 0, left: 0, containLabel: true },
      xAxis: {
        type: "category",
        data: dates,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          fontSize: 11,
          color: palette.tick,
          hideOverlap: true,
          formatter: (v: string) => formatXTick(v, period),
          interval: step === null ? ("auto" as const) : (index: number) => index % step === 0,
        },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 11, color: palette.tick, formatter: fmtEur },
        splitLine: { lineStyle: { color: palette.grid, type: "dashed" } },
      },
      visualMap: hasMixed
        ? {
            show: false,
            seriesIndex: 0,
            dimension: 1,
            pieces: [
              { gt: 0, color: palette.income },
              { lte: 0, color: palette.expense },
            ],
          }
        : undefined,
      tooltip: {
        trigger: "axis",
        axisPointer: { lineStyle: { color: palette.grid, type: "dashed" } },
        ...tooltipStyle(palette),
        formatter: (params: unknown) => {
          const items = params as { axisValue: string; value: number }[];
          if (!items.length) return "";
          const balance = items[0].value;
          const color = balance < 0 ? palette.expense : palette.income;
          return (
            `<p style="margin:0 0 4px;color:${palette.tick}">${formatTooltipLabel(items[0].axisValue, period)}</p>` +
            `<p style="margin:0;font-weight:600;color:${color}">${fmtEur(balance)}</p>`
          );
        },
      },
      series: [
        {
          type: "line",
          data: balances,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2, color: singleColor },
          areaStyle: { color: singleColor, opacity: 0.15 },
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: { color: palette.grid, width: 1 },
            data: [{ yAxis: 0 }],
          },
        },
      ],
    };
  }, [data, period, palette]);

  return (
    <div className="space-y-4">
      {/* Period buttons */}
      <div className="flex gap-1">
        {PERIODS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-semibold transition-colors",
              period === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Cargando…
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Sin datos para el periodo seleccionado.
        </div>
      ) : (
        <div style={{ height: 300 }}>
          <EChart option={option} />
        </div>
      )}
    </div>
  );
}
