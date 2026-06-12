import { useState, useMemo } from "react";
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

import { cn } from "@/lib/utils";
import { useBalanceHistory } from "@/hooks/useCharts";
import { useTheme } from "@/hooks/useTheme";

type Period = "1M" | "3M" | "1A" | "5A";

const PERIODS: { label: string; value: Period }[] = [
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "1A", value: "1A" },
  { label: "5A", value: "5A" },
];

function tickInterval(period: Period, dataLen: number): number | "preserveStartEnd" {
  if (period === "1M") return Math.floor(dataLen / 6);
  if (period === "3M") return Math.floor(dataLen / 8);
  return "preserveStartEnd";
}

function formatXTick(dateStr: string, period: Period): string {
  const d = new Date(dateStr + "T00:00:00");
  if (period === "1M" || period === "3M") {
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }
  return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
}

function formatTooltipLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr + "T00:00:00");
  if (period === "1M" || period === "3M") {
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  }
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

export function BalanceHistoryChart() {
  const [period, setPeriod] = useState<Period>("1A");
  const { data = [], isLoading } = useBalanceHistory(period);
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const cardBg = isDark ? "#1f2937" : "#ffffff";
  const borderColor = isDark ? "#374151" : "#e5e7eb";

  // Compute where y=0 falls in the gradient (top=0, bottom=1)
  const { hasMixed, allNeg, zeroOffset } = useMemo(() => {
    if (!data.length) return { hasMixed: false, allNeg: false, zeroOffset: "0%" };
    const min = Math.min(...data.map((d) => d.balance));
    const max = Math.max(...data.map((d) => d.balance));
    const mixed = min < 0 && max > 0;
    const neg = max <= 0;
    // gradient y=0 → top of chart (max value), y=1 → bottom (min value)
    const frac = mixed ? max / (max - min) : 0;
    return { hasMixed: mixed, allNeg: neg, zeroOffset: `${(frac * 100).toFixed(2)}%` };
  }, [data]);

  // Single stroke color or gradient URL when crossing zero
  const strokeColor = allNeg ? "#ef4444" : hasMixed ? "url(#strokeGrad)" : "#22c55e";
  const lastBal = data[data.length - 1]?.balance ?? 0;
  const dotColor = lastBal < 0 ? "#ef4444" : "#22c55e";

  return (
    <div className="space-y-4">
      {/* Period buttons */}
      <div className="flex gap-1">
        {PERIODS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-semibold transition-colors",
              period === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Cargando…
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Sin datos para el periodo seleccionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {/* Fill gradient */}
              {hasMixed ? (
                <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset={zeroOffset} stopColor="#22c55e" stopOpacity={0} />
                  <stop offset={zeroOffset} stopColor="#ef4444" stopOpacity={0} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
                </linearGradient>
              ) : allNeg ? (
                <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2} />
                </linearGradient>
              ) : (
                <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              )}

              {/* Stroke gradient — only when crossing zero */}
              {hasMixed && (
                <linearGradient id="strokeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={zeroOffset} stopColor="#22c55e" />
                  <stop offset={zeroOffset} stopColor="#ef4444" />
                </linearGradient>
              )}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatXTick(v as string, period)}
              tick={{ fontSize: 11, fill: tickColor }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval(period, data.length)}
            />

            <YAxis
              tickFormatter={fmtEur}
              tick={{ fontSize: 11, fill: tickColor }}
              tickLine={false}
              axisLine={false}
              width={90}
            />

            <ReferenceLine y={0} stroke={gridColor} strokeWidth={1} />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const balance = (payload[0]?.payload as { balance: number })?.balance ?? 0;
                return (
                  <div
                    style={{
                      background: cardBg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: 12,
                      color: isDark ? "#f9fafb" : "#111827",
                    }}
                  >
                    <div style={{ marginBottom: 4, color: tickColor }}>
                      {formatTooltipLabel(label as string, period)}
                    </div>
                    <div style={{ fontWeight: 600, color: balance < 0 ? "#ef4444" : "#22c55e" }}>
                      {fmtEur(balance)}
                    </div>
                  </div>
                );
              }}
              cursor={{ stroke: gridColor, strokeWidth: 1, strokeDasharray: "4 4" }}
            />

            <Area
              type="monotone"
              dataKey="balance"
              stroke={strokeColor}
              strokeWidth={2}
              fill="url(#fillGrad)"
              dot={false}
              activeDot={{ r: 4, fill: dotColor, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
