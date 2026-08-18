import { useMemo } from "react";
import type { SankeyData } from "@/api/client";
import { EChart } from "@/components/charts/EChart";
import type { EChartsCoreOption } from "@/lib/echarts";
import { useEChartsTheme, tooltipStyle } from "@/hooks/useEChartsTheme";

interface Props {
  data: SankeyData;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

export function SankeyChart({ data }: Props) {
  const palette = useEChartsTheme();

  const option = useMemo<EChartsCoreOption>(() => {
    const labelById = new Map(data.nodes.map((n) => [n.id, n.label]));

    return {
      tooltip: {
        trigger: "item",
        ...tooltipStyle(palette),
        formatter: (params: unknown) => {
          const p = params as {
            dataType: string;
            name: string;
            value: number;
            data: { source?: string; target?: string };
          };
          if (p.dataType === "edge") {
            const src = labelById.get(p.data.source ?? "") ?? p.data.source;
            const dst = labelById.get(p.data.target ?? "") ?? p.data.target;
            return (
              `<p style="margin:0;font-weight:600">${src} → ${dst}</p>` +
              `<p style="margin:0;color:${palette.tick}">${fmt(p.value)}</p>`
            );
          }
          const label = labelById.get(p.name) ?? p.name;
          return (
            `<p style="margin:0;font-weight:600">${label}</p>` +
            `<p style="margin:0;color:${palette.tick}">${fmt(p.value)}</p>`
          );
        },
      },
      series: [
        {
          type: "sankey",
          left: 120,
          right: 120,
          top: 16,
          bottom: 16,
          nodeWidth: 20,
          nodeGap: 20,
          nodeAlign: "justify",
          emphasis: { focus: "adjacency" },
          label: {
            color: palette.text,
            fontSize: 12,
            formatter: (p: { name: string }) => labelById.get(p.name) ?? p.name,
          },
          lineStyle: { color: "gradient", opacity: 0.4, curveness: 0.5 },
          data: data.nodes.map((n) => ({ name: n.id })),
          links: data.links,
        },
      ],
    };
  }, [data, palette]);

  if (!data.nodes.length || !data.links.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sin suficientes datos para mostrar el flujo.
      </div>
    );
  }

  return <EChart option={option} />;
}
