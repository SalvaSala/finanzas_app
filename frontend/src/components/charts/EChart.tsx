import { useEffect, useRef } from "react";
import { echarts } from "@/lib/echarts";
import type { EChartsCoreOption } from "@/lib/echarts";

interface Props {
  option: EChartsCoreOption;
  /** Suscripciones a eventos de ECharts (p.ej. { click: (params) => ... }). */
  onEvents?: Record<string, (params: unknown) => void>;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wrapper mínimo de Apache ECharts para React: inicializa el gráfico,
 * actualiza la opción al cambiar, se redimensiona con el contenedor
 * (ResizeObserver) y libera recursos al desmontar.
 */
export function EChart({ option, onEvents, className, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => {
      if (!chart.isDisposed()) chart.resize();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvents) return;
    const entries = Object.entries(onEvents);
    entries.forEach(([event, handler]) => chart.on(event, handler));
    return () => {
      entries.forEach(([event, handler]) => chart.off(event, handler));
    };
  }, [onEvents]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}
