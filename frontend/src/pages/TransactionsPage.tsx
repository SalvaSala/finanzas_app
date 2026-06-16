import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { Skeleton } from "@/components/ui/skeleton";

const now = new Date();

function TransactionTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TransactionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as
    | { initialCategoryId?: number; initialNoCategorized?: boolean }
    | null;

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRead | undefined>();
  const [duplicating, setDuplicating] = useState<TransactionRead | undefined>();

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
    setDuplicating(undefined);
    setFormOpen(true);
  }

  function openEdit(t: TransactionRead) {
    setEditing(t);
    setDuplicating(undefined);
    setFormOpen(true);
  }

  function convertToRecurring(t: TransactionRead) {
    navigate("/recurrentes", { state: { fromTransaction: t } });
  }

  function openDuplicate(t: TransactionRead) {
    setEditing(undefined);
    setDuplicating(t);
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
        <TransactionTableSkeleton />
      ) : (
        <TransactionTable
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          onEdit={openEdit}
          onDuplicate={openDuplicate}
        />
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setDuplicating(undefined);
        }}
        transaction={editing}
        duplicateFrom={duplicating}
        accounts={accounts}
        categories={categories}
        tags={tags}
        onConvertToRecurring={convertToRecurring}
      />

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
