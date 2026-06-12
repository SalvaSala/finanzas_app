import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BudgetsPage } from "@/pages/BudgetsPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { CategorizationRulesPage } from "@/pages/CategorizationRulesPage";
import { ChartsPage } from "@/pages/ChartsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { RecurringPage } from "@/pages/RecurringPage";
import { SavingsGoalsPage } from "@/pages/SavingsGoalsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TagsPage } from "@/pages/TagsPage";
import { TransactionsPage } from "@/pages/TransactionsPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transacciones" element={<TransactionsPage />} />
          <Route path="presupuestos" element={<BudgetsPage />} />
          <Route path="ahorro" element={<SavingsGoalsPage />} />
          <Route path="recurrentes" element={<RecurringPage />} />
          <Route path="etiquetas" element={<TagsPage />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="reglas" element={<CategorizationRulesPage />} />
          <Route path="graficos" element={<ChartsPage />} />
          <Route path="ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
  );
}
