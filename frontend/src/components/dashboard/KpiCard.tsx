import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

interface Props {
  title: string;
  amount: string;
  variant: "income" | "expense" | "balance";
  change?: number | null;
}

export function KpiCard({ title, amount, variant, change }: Props) {
  const num = parseFloat(amount);
  const abs = EUR.format(Math.abs(num));

  const display =
    variant === "expense"
      ? `-${abs}`
      : variant === "balance"
        ? num < 0
          ? `-${abs}`
          : abs
        : abs;

  const colorClass =
    variant === "income"
      ? "text-income"
      : variant === "expense"
        ? "text-expense"
        : num >= 0
          ? "text-income"
          : "text-expense";

  // For expenses, going up is bad (red); for income/balance, going up is good (green)
  const changeIsGood =
    change == null
      ? null
      : variant === "expense"
        ? change < 0
        : change > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-bold tabular-nums", colorClass)}>{display}</p>
        {change != null && (
          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-xs font-medium",
              changeIsGood ? "text-income" : "text-expense",
            )}
          >
            {change > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}% vs periodo anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
