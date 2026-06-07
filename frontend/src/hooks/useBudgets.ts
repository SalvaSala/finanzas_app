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
