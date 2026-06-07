import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface Props {
  year: number;
  month: number | undefined;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number | undefined) => void;
}

export function PeriodSelector({ year, month, onYearChange, onMonthChange }: Props) {
  const now = new Date().getFullYear();
  const years = [now - 2, now - 1, now];

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {years.map((y) => (
          <Button
            key={y}
            size="sm"
            variant={y === year ? "default" : "outline"}
            onClick={() => onYearChange(y)}
          >
            {y}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {MONTHS.map((label, i) => (
          <Button
            key={i}
            size="sm"
            variant={month === i + 1 ? "default" : "ghost"}
            className={cn("px-2.5", month !== i + 1 && "text-muted-foreground")}
            onClick={() => onMonthChange(i + 1)}
          >
            {label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={month === undefined ? "default" : "ghost"}
          className={cn(month !== undefined && "text-muted-foreground")}
          onClick={() => onMonthChange(undefined)}
        >
          Año completo
        </Button>
      </div>
    </div>
  );
}
