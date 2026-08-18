/**
 * Registro central de Apache ECharts con imports modulares (tree-shaking).
 * Solo se incluyen en el bundle los gráficos/componentes listados aquí.
 * Añadir nuevos tipos de gráfico implica registrarlos en este archivo.
 */
import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
  SankeyChart,
  HeatmapChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  VisualMapComponent,
  CalendarComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition, LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
  SankeyChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  VisualMapComponent,
  CalendarComponent,
  LabelLayout,
  UniversalTransition,
  LegacyGridContainLabel,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsCoreOption } from "echarts/core";
