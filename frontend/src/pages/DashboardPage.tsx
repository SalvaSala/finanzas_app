import { useState } from "react";

import { useDashboard, useDashboardMonthly } from "@/hooks/useDashboard";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";

import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ExpenseDonut } from "@/components/dashboard/ExpenseDonut";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { MonthlyBarChart } from "@/components/dashboard/MonthlyBarChart";
import { BalanceEvolutionChart } from "@/components/dashboard/BalanceEvolutionChart";
import { Separator } from "@/components/ui/separator";

const now = new Date();

export function DashboardPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(now.getMonth() + 1);

  const { data: summary, isLoading } = useDashboard(year, month);
  const { data: monthly = [] } = useDashboardMonthly(year);
  const { data: recentTx = [] } = useTransactions({ year, month, limit: 5 });
  const { data: categories = [] } = useCategories();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen financiero · {month ? `mes ${month} / ` : ""}
          {year}
        </p>
      </div>

      {/* Period selector */}
      <PeriodSelector
        year={year}
        month={month}
        onYearChange={setYear}
        onMonthChange={setMonth}
      />

      <Separator />

      {isLoading || !summary ? (
        <div className="py-24 text-center text-muted-foreground">Cargando…</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard title="Ingresos" amount={summary.income} variant="income" />
            <KpiCard title="Gastos" amount={summary.expense} variant="expense" />
            <KpiCard title="Balance" amount={summary.balance} variant="balance" />
          </div>

          {/* Donuts + recent transactions */}
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-5">
              <ExpenseDonut data={summary.expense_by_category} />
            </div>
            <div className="rounded-xl border bg-card p-5">
              <RecentTransactions transactions={recentTx} categories={categories} />
            </div>
          </div>

          {/* Monthly charts (always show for the selected year) */}
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-5">
              <MonthlyBarChart data={monthly} />
            </div>
            <div className="rounded-xl border bg-card p-5">
              <BalanceEvolutionChart data={monthly} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
