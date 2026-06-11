import { ResponsiveSankey } from "@nivo/sankey";
import type { DefaultLink, DefaultNode } from "@nivo/sankey";
import type { SankeyData } from "@/api/client";
import { useNivoTheme } from "@/hooks/useNivoTheme";
import { useTheme } from "@/hooks/useTheme";

interface SankeyNodeWithLabel extends DefaultNode {
  label: string;
}

interface Props {
  data: SankeyData;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

export function SankeyChart({ data }: Props) {
  const nivoTheme = useNivoTheme();
  const { theme } = useTheme();

  const labelColor = theme === "dark" ? "#e5e7eb" : "#374151";

  if (!data.nodes.length || !data.links.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sin suficientes datos para mostrar el flujo.
      </div>
    );
  }

  return (
    <ResponsiveSankey<SankeyNodeWithLabel, DefaultLink>
      data={
        data as unknown as {
          nodes: SankeyNodeWithLabel[];
          links: DefaultLink[];
        }
      }
      margin={{ top: 16, right: 120, bottom: 16, left: 120 }}
      align="justify"
      colors={{ scheme: "paired" }}
      nodeOpacity={1}
      nodeHoverOthersOpacity={0.35}
      nodeThickness={20}
      nodeSpacing={20}
      nodeBorderWidth={0}
      nodeBorderRadius={3}
      linkOpacity={0.4}
      linkHoverOthersOpacity={0.1}
      linkContract={1}
      enableLinkGradient
      theme={nivoTheme}
      label="label"
      labelTextColor={labelColor}
      nodeTooltip={({ node }) => (
        <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
          <div className="font-semibold">{node.label}</div>
          <div className="text-muted-foreground">{fmt(node.value)}</div>
        </div>
      )}
      labelPosition="outside"
      labelOrientation="horizontal"
      labelPadding={16}
    />
  );
}
