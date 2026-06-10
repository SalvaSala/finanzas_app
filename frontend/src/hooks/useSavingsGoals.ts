import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SavingsGoalContribute, SavingsGoalCreate, SavingsGoalUpdate } from "@/api/client";
import { api } from "@/api/client";

const KEY = ["savings-goals"];

export function useSavingsGoals() {
  return useQuery({ queryKey: KEY, queryFn: () => api.savingsGoals.list() });
}

export function useCreateSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SavingsGoalCreate) => api.savingsGoals.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SavingsGoalUpdate }) =>
      api.savingsGoals.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.savingsGoals.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useContributeSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SavingsGoalContribute }) =>
      api.savingsGoals.contribute(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
