import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { CategoryType } from "@/api/client";

export function useCategories(type?: CategoryType) {
  return useQuery({
    queryKey: ["categories", type],
    queryFn: async () => {
      const all = await api.categories.list();
      return type ? all.filter((c) => c.type === type) : all;
    },
  });
}
