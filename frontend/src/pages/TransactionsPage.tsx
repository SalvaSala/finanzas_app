import { useState } from "react";
import { Plus } from "lucide-react";

import type { ListTransactionsQuery, TransactionRead } from "@/api/client";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const now = new Date();

export function TransactionsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRead | undefined>();

  const [filters, setFilters] = useState<ListTransactionsQuery>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const { data: transactions = [], isLoading: loadingTx } = useTransactions(filters);
  const { data: accounts = [], isLoading: loadingAcc } = useAccounts();
  const { data: categories = [] } = useCategories();

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(t: TransactionRead) {
    setEditing(t);
    setFormOpen(true);
  }

  function handleYearChange(year: number) {
    setFilters((f) => ({ ...f, year, month: undefined }));
  }

  function handleMonthChange(month: number | undefined) {
    setFilters((f) => ({ ...f, month }));
  }

  const loading = loadingTx || loadingAcc;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            {transactions.length} resultado{transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

      <PeriodSelector
        year={filters.year ?? now.getFullYear()}
        month={filters.month ?? undefined}
        onYearChange={handleYearChange}
        onMonthChange={handleMonthChange}
      />

      <TransactionFilters
        filters={filters}
        onChange={setFilters}
        accounts={accounts}
        categories={categories}
      />

      <Separator />

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">Cargando…</div>
      ) : (
        <TransactionTable
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          onEdit={openEdit}
        />
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editing}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
