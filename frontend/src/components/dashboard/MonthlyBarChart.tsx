import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonthlyStats } from "@/api/client";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

interface Props {
  data: MonthlyStats[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow space-y-1">
      <p className="font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {EUR.format(p.value)}
        </p>
      ))}
    </div>
  );
}

export function MonthlyBarChart({ data }: Props) {
  const chartData = data.map((d) => ({
    month: MONTHS[d.month - 1],
    Ingresos: parseFloat(String(d.income)),
    Gastos: parseFloat(String(d.expense)),
  }));

  const hasData = data.some((d) => parseFloat(String(d.income)) > 0 || parseFloat(String(d.expense)) > 0);

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
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barCategoryGap="30%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => EUR.format(v)}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Ingresos" fill="var(--color-income, #22c55e)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Gastos" fill="var(--color-expense, #ef4444)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
