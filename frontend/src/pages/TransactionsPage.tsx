import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Download, Upload } from "lucide-react";
import { toast } from "sonner";

import type { ListTransactionsQuery, TransactionRead } from "@/api/client";
import { api } from "@/api/client";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useTags } from "@/hooks/useTags";
import { useTransactions } from "@/hooks/useTransactions";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { CsvImportDialog } from "@/components/transactions/CsvImportDialog";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const now = new Date();

export function TransactionsPage() {
  const location = useLocation();
  const locationState = location.state as
    | { initialCategoryId?: number; initialNoCategorized?: boolean }
    | null;

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRead | undefined>();

  const initialFilters = (): ListTransactionsQuery => {
    if (locationState?.initialNoCategorized) {
      return { no_category: true };
    }
    if (locationState?.initialCategoryId != null) {
      return { category_id: locationState.initialCategoryId };
    }
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  };

  const [filters, setFilters] = useState<ListTransactionsQuery>(initialFilters);

  const { data: transactions = [], isLoading: loadingTx } = useTransactions(filters);
  const { data: accounts = [], isLoading: loadingAcc } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(t: TransactionRead) {
    setEditing(t);
    setFormOpen(true);
  }

  async function handleExport() {
    try {
      const res = await api.transactions.exportCsv(filters);
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al exportar el CSV");
    }
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={transactions.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={openCreate} disabled={loading}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo movimiento
          </Button>
        </div>
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
        tags={tags}
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
        tags={tags}
      />

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
