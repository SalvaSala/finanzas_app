import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { CategoryCreate, CategoryType, CategoryUpdate } from "@/api/client";

export function useCategories(type?: CategoryType) {
  return useQuery({
    queryKey: ["categories", type],
    queryFn: async () => {
      const all = await api.categories.list();
      return type ? all.filter((c) => c.type === type) : all;
    },
  });
}

export function useCategoryMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const create = useMutation({
    mutationFn: (data: CategoryCreate) => api.categories.create(data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryUpdate }) =>
      api.categories.update(id, data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.categories.delete(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
