import { ResponsiveTreeMap } from "@nivo/treemap";
import type { TreemapData } from "@/api/client";
import { useNivoTheme } from "@/hooks/useNivoTheme";

interface Props {
  data: TreemapData;
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

export function TreemapChart({ data }: Props) {
  const nivoTheme = useNivoTheme();

  if (!data.children.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sin datos de gastos para el periodo.
      </div>
    );
  }

  return (
    <ResponsiveTreeMap
      data={data as Parameters<typeof ResponsiveTreeMap>[0]["data"]}
      identity="name"
      value="value"
      valueFormat={fmtEur}
      theme={nivoTheme}
      colors={{ scheme: "paired" }}
      borderWidth={2}
      borderColor={{ from: "color", modifiers: [["darker", 0.5]] }}
      labelSkipSize={24}
      label="name"
      parentLabelPadding={8}
      parentLabelTextColor={{ from: "color", modifiers: [["darker", 2]] }}
      tooltip={({ node }) => (
        <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
          <div className="font-semibold">{node.id}</div>
          <div className="text-muted-foreground">{fmtEur(node.value)}</div>
        </div>
      )}
    />
  );
}
