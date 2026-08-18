import { useMemo } from "react";
import type { MonthlyStats } from "@/api/client";
import { echarts } from "@/lib/echarts";
import type { EChartsCoreOption } from "@/lib/echarts";
import { EChart } from "@/components/charts/EChart";
import { useEChartsTheme, tooltipStyle } from "@/hooks/useEChartsTheme";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

interface Props {
  data: MonthlyStats[];
}

export function BalanceEvolutionChart({ data }: Props) {
  const palette = useEChartsTheme();

  const chartData = useMemo(
    () => ({
      months: data.map((d) => MONTHS[d.month - 1]),
      values: data.map((d) => parseFloat(String(d.cumulative_balance))),
    }),
    [data],
  );

  const hasData = chartData.values.some((v) => v !== 0);

  const option = useMemo<EChartsCoreOption>(() => {
    const { months, values } = chartData;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const hasNegative = min < 0;
    const hasPositive = max > 0;

    // Verde si siempre positivo, rojo si siempre negativo, color primario si cruza cero
    const lineColor = !hasNegative
      ? palette.income
      : !hasPositive
        ? palette.expense
        : palette.primary;

    return {
      grid: { top: 8, right: 8, bottom: 8, left: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: months,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { fontSize: 11, color: palette.tick },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 11, color: palette.tick, formatter: (v: number) => EUR.format(v) },
        splitLine: { lineStyle: { color: palette.grid, type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(palette),
        formatter: (params: unknown) => {
          const items = params as { axisValue: string; value: number }[];
          if (!items.length) return "";
          const value = items[0].value;
          const color = value >= 0 ? palette.income : palette.expense;
          return `<p style="font-weight:500;margin:0 0 4px">${items[0].axisValue}</p>` +
            `<p style="margin:0;color:${color}">Balance: ${EUR.format(value)}</p>`;
        },
      },
      series: [
        {
          name: "Balance",
          type: "line",
          data: values,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: true,
          lineStyle: { width: 2, color: lineColor },
          itemStyle: { color: lineColor },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0.05, color: `${lineColor}4D` },
              { offset: 0.95, color: `${lineColor}05` },
            ]),
          },
          markLine:
            hasNegative && hasPositive
              ? {
                  silent: true,
                  symbol: "none",
                  label: { show: false },
                  lineStyle: { color: palette.tick, type: "dashed" },
                  data: [{ yAxis: 0 }],
                }
              : undefined,
        },
      ],
    };
  }, [chartData, palette]);

  if (!hasData) {
    return (
      <div className="flex h-full flex-col">
        <p className="mb-2 text-sm font-medium text-muted-foreground">Evolución del balance</p>
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
          Sin datos para este año
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-sm font-medium text-muted-foreground">Evolución del balance</p>
      <div style={{ height: 220 }}>
        <EChart option={option} />
      </div>
    </div>
  );
}
