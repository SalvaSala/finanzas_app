import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { BalanceAdjustmentCreate, BalanceSet } from "@/api/client";
import { api } from "@/api/client";

const KEY = ["balance"];
const ADJUSTMENTS_KEY = ["balance", "adjustments"];

/** Invalidate the balance and everything derived from it after a write. */
function useBalanceInvalidation() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: KEY });
  };
}

export function useBalance() {
  return useQuery({ queryKey: KEY, queryFn: () => api.balance.status() });
}

export function useBalanceAdjustments() {
  return useQuery({
    queryKey: ADJUSTMENTS_KEY,
    queryFn: () => api.balance.adjustments.list(),
  });
}

export function useSetBalance() {
  const invalidate = useBalanceInvalidation();
  return useMutation({
    mutationFn: (data: BalanceSet) => api.balance.setAvailable(data),
    onSuccess: invalidate,
  });
}

export function useCreateBalanceAdjustment() {
  const invalidate = useBalanceInvalidation();
  return useMutation({
    mutationFn: (data: BalanceAdjustmentCreate) => api.balance.adjustments.create(data),
    onSuccess: invalidate,
  });
}

export function useDeleteBalanceAdjustment() {
  const invalidate = useBalanceInvalidation();
  return useMutation({
    mutationFn: (id: number) => api.balance.adjustments.delete(id),
    onSuccess: invalidate,
  });
}
