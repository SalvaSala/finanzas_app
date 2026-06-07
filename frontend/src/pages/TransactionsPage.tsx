import { useState } from "react";
import { Plus } from "lucide-react";

import type { TransactionRead } from "@/api/client";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionTable } from "@/components/transactions/TransactionTable";

export function TransactionsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRead | undefined>();

  const { data: transactions = [], isLoading: loadingTx } = useTransactions();
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

  const loading = loadingTx || loadingAcc;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            {transactions.length} movimiento{transactions.length !== 1 ? "s" : ""} registrado
            {transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

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
