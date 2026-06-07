import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

interface Props {
  title: string;
  amount: string;
  variant: "income" | "expense" | "balance";
}

export function KpiCard({ title, amount, variant }: Props) {
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-bold tabular-nums", colorClass)}>{display}</p>
      </CardContent>
    </Card>
  );
}
