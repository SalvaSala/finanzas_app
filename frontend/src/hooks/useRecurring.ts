import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecurringCreate, type RecurringUpdate } from "@/api/client";

// Generating recurrences (on create or manual run) materialises transactions,
// so we also refresh the views that depend on them.
const DEPENDENT_KEYS = [["recurring"], ["transactions"], ["dashboard"], ["budgets"]];

function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
  for (const key of DEPENDENT_KEYS) qc.invalidateQueries({ queryKey: key });
}

export function useRecurring() {
  return useQuery({ queryKey: ["recurring"], queryFn: () => api.recurring.list() });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RecurringCreate) => api.recurring.create(data),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RecurringUpdate }) =>
      api.recurring.update(id, data),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.recurring.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });
}

export function useRunRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.recurring.run(),
    onSuccess: () => invalidateAll(qc),
  });
}
