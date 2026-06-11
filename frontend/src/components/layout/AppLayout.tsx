import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, Target, Repeat, Tag, PiggyBank, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transacciones", label: "Movimientos", icon: ArrowLeftRight },
  { to: "/presupuestos", label: "Presupuestos", icon: Target },
  { to: "/ahorro", label: "Ahorro", icon: PiggyBank },
  { to: "/recurrentes", label: "Recurrentes", icon: Repeat },
  { to: "/etiquetas", label: "Etiquetas", icon: Tag },
  { to: "/reglas", label: "Reglas auto", icon: Wand2 },
];

export function AppLayout() {
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
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
