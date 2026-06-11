import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CategorizationRuleCreate,
  CategorizationRuleUpdate,
} from "@/api/client";
import { api } from "@/api/client";

const KEY = ["categorization-rules"];

export function useCategorizationRules() {
  return useQuery({ queryKey: KEY, queryFn: () => api.categorizationRules.list() });
}

export function useCreateCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CategorizationRuleCreate) => api.categorizationRules.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategorizationRuleUpdate }) =>
      api.categorizationRules.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.categorizationRules.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
