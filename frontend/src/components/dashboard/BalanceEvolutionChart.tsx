import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow">
      <p className="font-medium">{label}</p>
      <p className={value >= 0 ? "text-income" : "text-expense"}>
        Balance: {EUR.format(value)}
      </p>
    </div>
  );
}

export function BalanceEvolutionChart({ data }: Props) {
  const chartData = data.map((d) => ({
    month: MONTHS[d.month - 1],
    balance: parseFloat(String(d.cumulative_balance)),
  }));

  const hasData = data.some((d) => parseFloat(String(d.cumulative_balance)) !== 0);

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

  const values = chartData.map((d) => d.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const hasNegative = min < 0;
  const hasPositive = max > 0;

  // Use green when always positive, red when always negative, both otherwise
  const areaColor = !hasNegative
    ? "var(--color-income, #22c55e)"
    : !hasPositive
      ? "var(--color-expense, #ef4444)"
      : "hsl(var(--primary))";

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-sm font-medium text-muted-foreground">Evolución del balance</p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={areaColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={areaColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
          <Tooltip content={<CustomTooltip />} />
          {hasNegative && hasPositive && <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />}
          <Area
            type="monotone"
            dataKey="balance"
            stroke={areaColor}
            strokeWidth={2}
            fill="url(#balanceGradient)"
            dot={{ r: 3, fill: areaColor, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: areaColor, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
