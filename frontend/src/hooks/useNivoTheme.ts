import { useMemo } from "react";
import type { PartialTheme } from "@nivo/theming";
import { useTheme } from "@/hooks/useTheme";

export function useNivoTheme(): PartialTheme {
  const { theme } = useTheme();

  return useMemo(
    () => ({
      background: "transparent",
      text: {
        fill: theme === "dark" ? "#e5e7eb" : "#374151",
        fontSize: 12,
      },
      tooltip: {
        container: {
          background: theme === "dark" ? "#1f2937" : "#ffffff",
          color: theme === "dark" ? "#f9fafb" : "#111827",
          fontSize: 12,
          borderRadius: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        },
      },
      grid: {
        line: {
          stroke: theme === "dark" ? "#374151" : "#e5e7eb",
        },
      },
      axis: {
        ticks: {
          line: { stroke: theme === "dark" ? "#4b5563" : "#d1d5db" },
          text: { fill: theme === "dark" ? "#9ca3af" : "#6b7280", fontSize: 11 },
        },
        legend: {
          text: { fill: theme === "dark" ? "#d1d5db" : "#374151", fontSize: 12 },
        },
      },
      legends: {
        text: { fill: theme === "dark" ? "#d1d5db" : "#374151" },
      },
    }),
    [theme],
  );
}
