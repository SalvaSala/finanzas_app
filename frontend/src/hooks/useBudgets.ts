import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type BudgetCreate, type BudgetUpdate } from "@/api/client";

export function useBudgets() {
  return useQuery({ queryKey: ["budgets"], queryFn: () => api.budgets.list() });
}

export function useBudgetProgress(year: number, month?: number) {
  return useQuery({
    queryKey: ["budgets", "progress", year, month],
    queryFn: () => api.budgets.progress(year, month),
    enabled: year > 0,
  });
}

/** Número de presupuestos superados en el mes actual (para el badge del menú). */
export function useBudgetExceededCount() {
  const now = new Date();
  return useQuery({
    queryKey: ["budgets", "progress", now.getFullYear(), now.getMonth() + 1],
    queryFn: () => api.budgets.progress(now.getFullYear(), now.getMonth() + 1),
    select: (data) => data.filter((b) => b.exceeded).length,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BudgetCreate) => api.budgets.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BudgetUpdate }) =>
      api.budgets.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.budgets.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}
