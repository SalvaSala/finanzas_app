import { useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";

/**
 * Paleta de colores concreta (hex) para ECharts según el tema activo.
 * ECharts renderiza en canvas, que no resuelve variables CSS, por lo que
 * los colores deben ser valores literales equivalentes a los del tema.
 */
export interface ChartPalette {
  isDark: boolean;
  text: string;
  tick: string;
  grid: string;
  axisLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  income: string;
  expense: string;
  primary: string;
}

export function useEChartsTheme(): ChartPalette {
  const { theme } = useTheme();

  return useMemo(() => {
    const isDark = theme === "dark";
    return {
      isDark,
      text: isDark ? "#e5e7eb" : "#374151",
      tick: isDark ? "#9ca3af" : "#6b7280",
      grid: isDark ? "#374151" : "#e5e7eb",
      axisLine: isDark ? "#4b5563" : "#d1d5db",
      tooltipBg: isDark ? "#1f2937" : "#ffffff",
      tooltipBorder: isDark ? "#374151" : "#e5e7eb",
      tooltipText: isDark ? "#f9fafb" : "#111827",
      income: "#22c55e",
      expense: "#ef4444",
      primary: isDark ? "#60a5fa" : "#2563eb",
    };
  }, [theme]);
}

/** Estilo base del tooltip para que se parezca a las tarjetas de la app. */
export function tooltipStyle(p: ChartPalette) {
  return {
    backgroundColor: p.tooltipBg,
    borderColor: p.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12] as [number, number],
    textStyle: { color: p.tooltipText, fontSize: 12 },
    extraCssText: "border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);",
  };
}
