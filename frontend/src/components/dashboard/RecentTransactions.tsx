import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import type { CategoryRead, TransactionRead } from "@/api/client";
import { formatAmount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  transactions: TransactionRead[];
  categories: CategoryRead[];
}

export function RecentTransactions({ transactions, categories }: Props) {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Últimos movimientos</p>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
          <Link to="/transacciones">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Sin movimientos en este periodo
        </div>
      ) : (
        <ul className="space-y-2">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{tx.concept}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(tx.date)}
                  {tx.category_id && (
                    <> · {catMap.get(tx.category_id) ?? "—"}</>
                  )}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 tabular-nums text-sm font-semibold",
                  tx.type === "income" ? "text-income" : "text-expense",
                )}
              >
                {formatAmount(tx.amount, tx.type)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
