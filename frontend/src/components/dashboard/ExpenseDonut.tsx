import { PieChart, Pie, Tooltip, ResponsiveContainer, Sector } from "recharts";
import type { PieSectorShapeProps } from "recharts";
import type { CategoryAmount } from "@/api/client";

const FALLBACK = [
  "#6366f1","#f97316","#14b8a6","#f43f5e","#8b5cf6",
  "#eab308","#06b6d4","#84cc16","#ec4899","#64748b",
];

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

interface ChartEntry {
  name: string;
  value: number;
  color: string;
  total: string;
}

interface Props {
  data: CategoryAmount[];
  title?: string;
}

function makeSectorShape(chartData: ChartEntry[]) {
  return function ColoredSector(props: PieSectorShapeProps) {
    const color = chartData[props.index]?.color ?? "#888";
    return <Sector {...props} fill={color} />;
  };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartEntry }[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow">
      <p className="font-medium">{entry.name}</p>
      <p className="text-muted-foreground">{EUR.format(entry.value)}</p>
    </div>
  );
}

export function ExpenseDonut({ data, title = "Gastos por categoría" }: Props) {
  const total = data.reduce((s, d) => s + parseFloat(d.total), 0);

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

  const chartData: ChartEntry[] = data.map((item, i) => ({
    name: item.name,
    value: parseFloat(item.total),
    color: item.color ?? FALLBACK[i % FALLBACK.length],
    total: item.total,
  }));

  const sectorShape = makeSectorShape(chartData);

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="80%"
            paddingAngle={2}
            shape={sectorShape}
          />
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <ul className="mt-3 space-y-1.5 overflow-y-auto text-sm">
        {chartData.map((entry) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
          return (
            <li key={entry.name} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="flex-1 truncate">{entry.name}</span>
              <span className="tabular-nums text-muted-foreground">{pct}%</span>
              <span className="tabular-nums font-medium">{EUR.format(entry.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
