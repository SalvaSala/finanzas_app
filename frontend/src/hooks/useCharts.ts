import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useTreemap(year: number, month?: number) {
  return useQuery({
    queryKey: ["charts", "treemap", year, month],
    queryFn: () => api.dashboard.treemap(year, month),
    enabled: year > 0,
  });
}

export function useCalendar(year: number) {
  return useQuery({
    queryKey: ["charts", "calendar", year],
    queryFn: () => api.dashboard.calendar(year),
    enabled: year > 0,
  });
}

export function useSankey(year: number, month?: number) {
  return useQuery({
    queryKey: ["charts", "sankey", year, month],
    queryFn: () => api.dashboard.sankey(year, month),
    enabled: year > 0,
  });
}
