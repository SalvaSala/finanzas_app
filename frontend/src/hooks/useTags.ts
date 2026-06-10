import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type TagCreate, type TagUpdate } from "@/api/client";

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: () => api.tags.list() });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TagCreate) => api.tags.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TagUpdate }) => api.tags.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.tags.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useSetTransactionTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, tagIds }: { transactionId: number; tagIds: number[] }) =>
      api.tags.setOnTransaction(transactionId, tagIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}
