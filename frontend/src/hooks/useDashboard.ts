import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useDashboard(year: number, month?: number) {
  return useQuery({
    queryKey: ["dashboard", year, month],
    queryFn: () => api.dashboard.summary(year, month),
    enabled: year > 0,
  });
}
