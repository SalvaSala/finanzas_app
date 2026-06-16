import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { CategoryAmount } from "@/api/client";

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

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartItem }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="font-medium">{item.name}</span>
      </div>
      <p className="mt-0.5 text-muted-foreground">{EUR.format(item.value)}</p>
    </div>
  );
}

function BarLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props;
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      fill="currentColor"
      fontSize={11}
      dominantBaseline="middle"
    >
      {EUR.format(value)}
    </text>
  );
}

export function TopCategoriesChart({ expenseData, incomeData }: Props) {
  const [type, setType] = useState<TxType>("expense");

  const rawData = type === "expense" ? expenseData : incomeData;

  const chartData: ChartItem[] = [...rawData]
    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
    .slice(0, 10)
    .map((item, i) => ({
      name: item.icon ? `${item.icon} ${item.name}` : item.name,
      value: parseFloat(item.total),
      color: item.color ?? FALLBACK[i % FALLBACK.length],
    }));

  const chartHeight = Math.max(chartData.length * 36 + 10, 80);

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
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 90, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} label={<BarLabel />}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
