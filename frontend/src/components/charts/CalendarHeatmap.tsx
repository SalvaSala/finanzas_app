import { ResponsiveCalendar } from "@nivo/calendar";
import type { DayAmount } from "@/api/client";
import { useNivoTheme } from "@/hooks/useNivoTheme";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  data: DayAmount[];
  year: number;
}

export function CalendarHeatmap({ data, year }: Props) {
  const nivoTheme = useNivoTheme();
  const { theme } = useTheme();

  const emptyColor = theme === "dark" ? "#1f2937" : "#f3f4f6";
  const monthBorderColor = theme === "dark" ? "#374151" : "#e5e7eb";

  const fmt = (v: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

  return (
    <ResponsiveCalendar
      data={data}
      from={`${year}-01-01`}
      to={`${year}-12-31`}
      emptyColor={emptyColor}
      colors={["#fef3c7", "#fcd34d", "#f97316", "#dc2626"]}
      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      yearSpacing={40}
      monthBorderColor={monthBorderColor}
      dayBorderWidth={2}
      dayBorderColor={emptyColor}
      theme={nivoTheme}
      legends={[
        {
          anchor: "bottom-right",
          direction: "row",
          translateY: 20,
          itemCount: 4,
          itemWidth: 42,
          itemHeight: 36,
          itemsSpacing: 14,
          itemDirection: "right-to-left",
        },
      ]}
      tooltip={({ day, value }) => (
        <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
          <div className="font-semibold">{day}</div>
          <div className="text-muted-foreground">{fmt(Number(value))}</div>
        </div>
      )}
    />
  );
}
