import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Pencil, Trash2, ChevronUp, ChevronDown, Repeat, Copy } from "lucide-react";
import { toast } from "sonner";

import type { AccountRead, CategoryRead, TransactionRead } from "@/api/client";
import { useDeleteTransaction } from "@/hooks/useTransactions";
import { formatAmount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  transactions: TransactionRead[];
  accounts: AccountRead[];
  categories: CategoryRead[];
  onEdit: (t: TransactionRead) => void;
  onDuplicate: (t: TransactionRead) => void;
}

function CategoryCell({
  categoryId,
  subcategoryId,
  categories,
}: {
  categoryId: number | null;
  subcategoryId: number | null;
  categories: CategoryRead[];
}) {
  const cat = categories.find((c) => c.id === categoryId);
  const sub = categories.find((c) => c.id === subcategoryId);
  if (!cat) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {cat.name}
      {sub && <span className="text-muted-foreground"> › {sub.name}</span>}
    </span>
  );
}

function DeleteDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: TransactionRead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const del = useDeleteTransaction();

  async function confirm() {
    if (!transaction) return;
    try {
      await del.mutateAsync(transaction.id);
      toast.success("Movimiento eliminado");
      onOpenChange(false);
    } catch {
      toast.error("Error al eliminar el movimiento");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar movimiento</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar{" "}
            <strong>{transaction?.concept}</strong>? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={del.isPending}>
            {del.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TransactionTable({ transactions, accounts, categories, onEdit, onDuplicate }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [toDelete, setToDelete] = useState<TransactionRead | null>(null);

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  const columns: ColumnDef<TransactionRead>[] = [
    {
      accessorKey: "date",
      header: "Fecha",
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ getValue }) => {
        const type = getValue<"income" | "expense" | "transfer">();
        const label =
          type === "income" ? "Ingreso" : type === "expense" ? "Gasto" : "Transferencia";
        const cls =
          type === "income"
            ? "border-income text-income"
            : type === "expense"
              ? "border-expense text-expense"
              : "border-muted-foreground text-muted-foreground";
        return (
          <Badge variant="outline" className={cn("text-xs", cls)}>
            {label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "concept",
      header: "Concepto",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.concept}
          {row.original.recurring_id != null && (
            <Repeat
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-label="Generado por una recurrencia"
            />
          )}
        </span>
      ),
    },
    {
      id: "tags",
      header: "Etiquetas",
      cell: ({ row }) => {
        const tags = row.original.tags ?? [];
        if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={
                  tag.color
                    ? { backgroundColor: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44` }
                    : undefined
                }
              >
                {tag.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: "category",
      header: "Categoría",
      cell: ({ row }) => (
        <CategoryCell
          categoryId={row.original.category_id}
          subcategoryId={row.original.subcategory_id}
          categories={categories}
        />
      ),
    },
    {
      id: "account",
      header: "Cuenta",
      cell: ({ row }) => {
        const { account_id, transfer_account_id, type } = row.original;
        const origin = accountMap.get(account_id) ?? "—";
        if (type === "transfer" && transfer_account_id) {
          const dest = accountMap.get(transfer_account_id) ?? "—";
          return (
            <span>
              {origin} <span className="text-muted-foreground">→</span> {dest}
            </span>
          );
        }
        return <span>{origin}</span>;
      },
    },
    {
      accessorKey: "amount",
      header: "Importe",
      cell: ({ row }) => {
        const { amount, type } = row.original;
        const colorClass =
          type === "income"
            ? "text-income"
            : type === "expense"
              ? "text-expense"
              : "text-muted-foreground";
        return (
          <span className={cn("font-medium tabular-nums", colorClass)}>
            {formatAmount(amount, type)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Duplicar"
            onClick={() => onDuplicate(row.original)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Editar"
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-expense hover:text-expense"
            title="Eliminar"
            onClick={() => setToDelete(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/40">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <ChevronUp className="h-3 w-3" />}
                      {header.column.getIsSorted() === "desc" && <ChevronDown className="h-3 w-3" />}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No hay movimientos. Crea el primero.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DeleteDialog
        transaction={toDelete}
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
      />
    </>
  );
}
