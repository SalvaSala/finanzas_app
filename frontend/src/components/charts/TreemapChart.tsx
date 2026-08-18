import { useMemo } from "react";
import type { TreemapData } from "@/api/client";
import { EChart } from "@/components/charts/EChart";
import type { EChartsCoreOption } from "@/lib/echarts";
import { useEChartsTheme, tooltipStyle } from "@/hooks/useEChartsTheme";

interface Props {
  data: TreemapData;
}

const PALETTE = [
  "#6366f1","#f97316","#14b8a6","#f43f5e","#8b5cf6",
  "#eab308","#06b6d4","#84cc16","#ec4899","#64748b",
];

const fmtEur = (v: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

export function TreemapChart({ data }: Props) {
  const palette = useEChartsTheme();

  const option = useMemo<EChartsCoreOption>(
    () => ({
      tooltip: {
        trigger: "item",
        ...tooltipStyle(palette),
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number };
          return (
            `<p style="margin:0;font-weight:600">${p.name}</p>` +
            `<p style="margin:0;color:${palette.tick}">${fmtEur(p.value)}</p>`
          );
        },
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          color: PALETTE,
          label: {
            show: true,
            formatter: "{b}",
            fontSize: 12,
            color: "#fff",
            textBorderColor: "rgba(0,0,0,0.25)",
            textBorderWidth: 2,
          },
          upperLabel: {
            show: true,
            height: 26,
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            textBorderColor: "rgba(0,0,0,0.25)",
            textBorderWidth: 2,
          },
          itemStyle: {
            borderWidth: 2,
            gapWidth: 2,
            borderColor: palette.isDark ? "#111827" : "#ffffff",
          },
          data: data.children,
        },
      ],
    }),
    [data, palette],
  );

  if (!data.children.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sin datos de gastos para el periodo.
      </div>
    );
  }

  return <EChart option={option} />;
}
