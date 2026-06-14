import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import type { CategoryAvgRow } from "@/api/client";
import { api } from "@/api/client";
import { useCategories } from "@/hooks/useCategories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

interface Props {
  year: number;
  month?: number;
}

type TxType = "expense" | "income";
type Level  = "categories" | "subcategories";

// ── Change badge ──────────────────────────────────────────────────────────────

function ChangeBadge({ pct, type }: { pct: number | null; type: TxType }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;

  // expense: positive pct (spending more) = bad = red; income: positive = good = green
  const isGood = type === "expense" ? pct < 0 : pct > 0;
  const colorClass = isGood ? "text-income" : "text-expense";
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  const sign = pct >= 0 ? "+" : "";

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

// ── Table rows ────────────────────────────────────────────────────────────────

function AvgTable({ rows, type }: { rows: CategoryAvgRow[]; type: TxType }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin datos para este periodo
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Categoría</th>
            <th className="pb-2 pr-3 text-right font-medium">Promedio mensual</th>
            <th className="pb-2 pr-3 text-right font-medium">Este periodo</th>
            <th className="pb-2 text-right font-medium">Vs. media</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.category_id} className="hover:bg-muted/30">
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  {row.color && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                  )}
                  {row.icon && <span className="text-base leading-none">{row.icon}</span>}
                  <span className="truncate">{row.name}</span>
                </div>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                {EUR.format(row.avg_monthly)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums font-medium">
                {EUR.format(row.current_amount)}
              </td>
              <td className="py-2 text-right">
                <ChangeBadge pct={row.change_pct} type={type} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CategoryAveragesTable({ year, month }: Props) {
  const [type, setType] = useState<TxType>("expense");
  const [level, setLevel] = useState<Level>("categories");
  const [parentId, setParentId] = useState<string | null>(null);

  const { data: categories = [] } = useCategories();
  const parentCategories = categories.filter((c) => c.parent_id === null && c.type === type);

  // When switching type, reset the parent selection if it doesn't belong to the new type
  function handleTypeChange(t: TxType) {
    setType(t);
    setParentId(null);
  }

  function handleLevelChange(l: Level) {
    setLevel(l);
    setParentId(null);
  }

  const numericParentId = parentId != null ? parseInt(parentId) : undefined;
  const enabledQuery = level === "categories" || numericParentId != null;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dashboard", "category-averages", type, year, month, numericParentId],
    queryFn: () => api.dashboard.categoryAverages(type, year, month, numericParentId),
    enabled: enabledQuery,
  });

  const periodLabel = month ? `${month}/${year}` : String(year);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Promedio mensual por categoría</h3>
          <p className="text-xs text-muted-foreground">
            Promedio acumulado del año vs. {periodLabel}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type toggle */}
          <div className="flex gap-1 rounded-md border bg-muted p-0.5">
            {(["expense", "income"] as TxType[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
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

          {/* Level toggle */}
          <div className="flex gap-1 rounded-md border bg-muted p-0.5">
            {(["categories", "subcategories"] as Level[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLevelChange(l)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  level === l
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l === "categories" ? "Categorías" : "Subcategorías"}
              </button>
            ))}
          </div>

          {/* Parent selector (only for subcategories) */}
          {level === "subcategories" && (
            <Select
              value={parentId ?? ""}
              onValueChange={(v) => setParentId(v || null)}
            >
              <SelectTrigger className="h-7 w-44 text-xs">
                <SelectValue placeholder="Seleccionar categoría…" />
              </SelectTrigger>
              <SelectContent>
                {parentCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.icon ? `${c.icon} ` : ""}{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Table */}
      {level === "subcategories" && !numericParentId ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Selecciona una categoría para ver sus subcategorías
        </p>
      ) : isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <AvgTable rows={rows} type={type} />
      )}
    </div>
  );
}
