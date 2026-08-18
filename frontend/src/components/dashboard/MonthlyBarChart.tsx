import { useMemo } from "react";
import type { MonthlyStats } from "@/api/client";
import { EChart } from "@/components/charts/EChart";
import type { EChartsCoreOption } from "@/lib/echarts";
import { useEChartsTheme, tooltipStyle } from "@/hooks/useEChartsTheme";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

interface Props {
  data: MonthlyStats[];
}

export function MonthlyBarChart({ data }: Props) {
  const palette = useEChartsTheme();

  const chartData = useMemo(
    () => ({
      months: data.map((d) => MONTHS[d.month - 1]),
      income: data.map((d) => parseFloat(String(d.income))),
      expense: data.map((d) => parseFloat(String(d.expense))),
    }),
    [data],
  );

  const hasData = chartData.income.some((v) => v > 0) || chartData.expense.some((v) => v > 0);

  const option = useMemo<EChartsCoreOption>(
    () => ({
      grid: { top: 8, right: 8, bottom: 32, left: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: chartData.months,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { fontSize: 11, color: palette.tick },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 11, color: palette.tick, formatter: (v: number) => EUR.format(v) },
        splitLine: { lineStyle: { color: palette.grid, type: "dashed" } },
      },
      legend: {
        bottom: 0,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { fontSize: 12, color: palette.text },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: palette.grid, opacity: 0.3 } },
        ...tooltipStyle(palette),
        formatter: (params: unknown) => {
          const items = params as { axisValue: string; seriesName: string; value: number; color: string }[];
          if (!items.length) return "";
          const title = `<p style="font-weight:500;margin:0 0 4px">${items[0].axisValue}</p>`;
          const rows = items
            .map(
              (p) =>
                `<p style="margin:0;color:${p.color}">${p.seriesName}: ${EUR.format(p.value)}</p>`,
            )
            .join("");
          return title + rows;
        },
      },
      series: [
        {
          name: "Ingresos",
          type: "bar",
          data: chartData.income,
          barCategoryGap: "30%",
          barGap: "10%",
          itemStyle: { color: palette.income, borderRadius: [3, 3, 0, 0] },
        },
        {
          name: "Gastos",
          type: "bar",
          data: chartData.expense,
          itemStyle: { color: palette.expense, borderRadius: [3, 3, 0, 0] },
        },
      ],
    }),
    [chartData, palette],
  );

  if (!hasData) {
    return (
      <div className="flex h-full flex-col">
        <p className="mb-2 text-sm font-medium text-muted-foreground">Ingresos vs Gastos por mes</p>
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
          Sin datos para este año
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-sm font-medium text-muted-foreground">Ingresos vs Gastos por mes</p>
      <div style={{ height: 220 }}>
        <EChart option={option} />
      </div>
    </div>
  );
}
