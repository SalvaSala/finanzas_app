import { useMemo } from "react";
import type { DayAmount } from "@/api/client";
import { EChart } from "@/components/charts/EChart";
import type { EChartsCoreOption } from "@/lib/echarts";
import { useEChartsTheme, tooltipStyle } from "@/hooks/useEChartsTheme";

interface Props {
  data: DayAmount[];
  year: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

export function CalendarHeatmap({ data, year }: Props) {
  const palette = useEChartsTheme();

  const emptyColor = palette.isDark ? "#1f2937" : "#f3f4f6";
  const monthBorderColor = palette.isDark ? "#374151" : "#e5e7eb";

  const option = useMemo<EChartsCoreOption>(() => {
    const max = data.length ? Math.max(...data.map((d) => d.value)) : 0;

    return {
      tooltip: {
        ...tooltipStyle(palette),
        formatter: (params: unknown) => {
          const p = params as { data: [string, number] };
          return (
            `<p style="margin:0;font-weight:600">${p.data[0]}</p>` +
            `<p style="margin:0;color:${palette.tick}">${fmt(p.data[1])}</p>`
          );
        },
      },
      visualMap: {
        type: "continuous",
        min: 0,
        max: max > 0 ? max : 1,
        calculable: false,
        orient: "horizontal",
        right: 10,
        bottom: 0,
        itemWidth: 12,
        itemHeight: 90,
        textStyle: { color: palette.tick, fontSize: 11 },
        inRange: { color: ["#fef3c7", "#fcd34d", "#f97316", "#dc2626"] },
      },
      calendar: {
        range: year,
        top: 30,
        left: 40,
        right: 20,
        bottom: 50,
        cellSize: ["auto", 14],
        yearLabel: { show: false },
        dayLabel: {
          color: palette.tick,
          fontSize: 10,
          nameMap: ["D", "L", "M", "X", "J", "V", "S"],
        },
        monthLabel: {
          color: palette.tick,
          fontSize: 11,
          nameMap: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
        },
        splitLine: { lineStyle: { color: monthBorderColor, width: 1 } },
        itemStyle: { color: emptyColor, borderColor: emptyColor, borderWidth: 2 },
      },
      series: [
        {
          type: "heatmap",
          coordinateSystem: "calendar",
          data: data.map((d) => [d.day, d.value]),
        },
      ],
    };
  }, [data, year, palette, emptyColor, monthBorderColor]);

  return <EChart option={option} />;
}
