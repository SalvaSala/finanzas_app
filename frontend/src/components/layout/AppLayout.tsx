import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Repeat,
  Tag,
  PiggyBank,
  Wand2,
  BarChart3,
  FolderTree,
  Sun,
  Moon,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useBudgetExceededCount } from "@/hooks/useBudgets";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transacciones", label: "Movimientos", icon: ArrowLeftRight },
  { to: "/presupuestos", label: "Presupuestos", icon: Target },
  { to: "/ahorro", label: "Ahorro", icon: PiggyBank },
  { to: "/recurrentes", label: "Recurrentes", icon: Repeat },
  { to: "/categorias", label: "Categorías", icon: FolderTree },
  { to: "/etiquetas", label: "Etiquetas", icon: Tag },
  { to: "/reglas", label: "Reglas auto", icon: Wand2 },
  { to: "/graficos", label: "Gráficos", icon: BarChart3 },
];

export function AppLayout() {
  const { theme, toggle } = useTheme();
  const { data: exceededCount = 0 } = useBudgetExceededCount();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-52 flex-col border-r bg-card px-3 py-6">
        <span className="mb-8 px-3 text-xl font-bold tracking-tight">FinApp</span>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {to === "/presupuestos" && exceededCount > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-expense/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-expense">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {exceededCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 px-3">
          <NavLink
            to="/ajustes"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <Settings className="h-4 w-4" />
            Ajustes
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={toggle}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
