import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, PiggyBank, CalendarClock, TrendingUp } from "lucide-react";

import type { SavingsGoalRead } from "@/api/client";
import {
  useContributeSavingsGoal,
  useCreateSavingsGoal,
  useDeleteSavingsGoal,
  useSavingsGoals,
  useUpdateSavingsGoal,
} from "@/hooks/useSavingsGoals";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// ── Preset colors ─────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEur(n: number | string) {
  return Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function deadlineLabel(days: number | null | undefined): string {
  if (days == null) return "";
  if (days < 0) return `Venció hace ${Math.abs(days)} días`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  return `${days} días restantes`;
}

function deadlineColor(days: number | null | undefined, completed: boolean): string {
  if (completed) return "text-income";
  if (days == null) return "text-muted-foreground";
  if (days < 0) return "text-expense";
  if (days <= 7) return "text-orange-500";
  return "text-muted-foreground";
}

// ── Goal form ─────────────────────────────────────────────────────────────────

const goalSchema = z.object({
  name: z.string().min(1, "Obligatorio").max(100),
  target_amount: z
    .string()
    .min(1, "Obligatorio")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Debe ser mayor que 0"),
  current_amount: z
    .string()
    .refine((v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), "Importe inválido"),
  deadline: z.string().optional(),
  color: z.string().optional(),
});

type GoalFormValues = z.infer<typeof goalSchema>;

function GoalForm({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal?: SavingsGoalRead;
}) {
  const create = useCreateSavingsGoal();
  const update = useUpdateSavingsGoal();
  const isEdit = !!goal;

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: goal?.name ?? "",
      target_amount: goal ? String(goal.target_amount) : "",
      current_amount: goal ? String(goal.current_amount) : "0",
      deadline: goal?.deadline ?? "",
      color: goal?.color ?? "",
    },
  });

  const watchColor = form.watch("color");

  async function onSubmit(values: GoalFormValues) {
    const payload = {
      name: values.name,
      target_amount: values.target_amount,
      current_amount: values.current_amount || "0",
      deadline: values.deadline || null,
      color: values.color || null,
    };
    try {
      if (isEdit && goal) {
        await update.mutateAsync({ id: goal.id, data: payload });
        toast.success("Objetivo actualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success("Objetivo creado");
      }
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error("Error al guardar el objetivo");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar objetivo" : "Nuevo objetivo de ahorro"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Vacaciones en Italia" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="target_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objetivo (€)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0.01" step="0.01" placeholder="2000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="current_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ya ahorrado (€)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha límite (opcional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color (opcional)</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor:
                            field.value === c ? "hsl(var(--foreground))" : "transparent",
                        }}
                        onClick={() => field.onChange(c)}
                      />
                    ))}
                    <button
                      type="button"
                      className="h-6 w-6 rounded-full border border-dashed border-muted-foreground text-muted-foreground text-xs hover:opacity-70"
                      onClick={() => field.onChange("")}
                      title="Sin color"
                    >
                      ✕
                    </button>
                  </div>
                  {watchColor && (
                    <div
                      className="mt-1 h-1.5 w-full rounded-full"
                      style={{ backgroundColor: watchColor }}
                    />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {create.isPending || update.isPending
                  ? "Guardando…"
                  : isEdit
                    ? "Guardar"
                    : "Crear"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Contribute dialog ─────────────────────────────────────────────────────────

const contributeSchema = z.object({
  amount: z
    .string()
    .min(1, "Obligatorio")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Debe ser mayor que 0"),
});

type ContributeValues = z.infer<typeof contributeSchema>;

function ContributeDialog({
  goal,
  open,
  onOpenChange,
}: {
  goal: SavingsGoalRead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const contribute = useContributeSavingsGoal();
  const form = useForm<ContributeValues>({ resolver: zodResolver(contributeSchema) });
  const remaining = Number(goal.target_amount) - Number(goal.current_amount);

  async function onSubmit(values: ContributeValues) {
    try {
      await contribute.mutateAsync({ id: goal.id, data: { amount: values.amount } });
      toast.success(`Añadidos ${formatEur(parseFloat(values.amount))} al objetivo`);
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error("Error al registrar la aportación");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Aportar a «{goal.name}»</DialogTitle>
          <DialogDescription>
            Faltan {formatEur(remaining > 0 ? remaining : 0)} para alcanzar el objetivo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Importe (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="100"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={contribute.isPending}>
                {contribute.isPending ? "Guardando…" : "Aportar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar objetivo</DialogTitle>
          <DialogDescription>¿Seguro que quieres eliminar este objetivo de ahorro?</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoalRead;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [contributeOpen, setContributeOpen] = useState(false);
  const pct = Math.min(goal.progress_pct, 100);
  const accentColor = goal.color ?? "hsl(var(--primary))";

  return (
    <>
      <div className="rounded-xl border bg-card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accentColor}22` }}
            >
              <PiggyBank className="h-4 w-4" style={{ color: accentColor }} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{goal.name}</p>
              {goal.is_completed ? (
                <span className="text-xs font-medium text-income">¡Objetivo alcanzado!</span>
              ) : (
                <span className={`text-xs ${deadlineColor(goal.days_remaining, goal.is_completed)}`}>
                  {goal.deadline
                    ? deadlineLabel(goal.days_remaining)
                    : "Sin fecha límite"}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-expense hover:text-expense"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Amounts */}
        <div className="flex items-end justify-between text-sm">
          <span className="text-muted-foreground">Ahorrado</span>
          <div className="text-right">
            <span className="font-semibold">{formatEur(goal.current_amount)}</span>
            <span className="text-muted-foreground"> / {formatEur(goal.target_amount)}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={pct} className="h-2" color={goal.color ?? undefined} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{pct.toFixed(1)}%</span>
            {!goal.is_completed && (
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Faltan {formatEur(Number(goal.target_amount) - Number(goal.current_amount))}
              </span>
            )}
          </div>
        </div>

        {/* Contribute button */}
        {!goal.is_completed && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setContributeOpen(true)}
          >
            <TrendingUp className="mr-2 h-3.5 w-3.5" />
            Añadir aportación
          </Button>
        )}
      </div>

      <ContributeDialog
        goal={goal}
        open={contributeOpen}
        onOpenChange={setContributeOpen}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SavingsGoalsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<SavingsGoalRead | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: goals = [], isLoading } = useSavingsGoals();
  const del = useDeleteSavingsGoal();

  const completed = goals.filter((g) => g.is_completed);
  const active = goals.filter((g) => !g.is_completed);

  async function handleDelete() {
    if (deleteId == null) return;
    try {
      await del.mutateAsync(deleteId);
      toast.success("Objetivo eliminado");
    } catch {
      toast.error("Error al eliminar el objetivo");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Objetivos de ahorro</h1>
          <p className="text-sm text-muted-foreground">
            Define metas y sigue tu progreso hasta alcanzarlas
          </p>
        </div>
        <Button
          onClick={() => {
            setEditGoal(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo objetivo
        </Button>
      </div>

      <Separator />

      {isLoading ? (
        <div className="py-24 text-center text-muted-foreground">Cargando…</div>
      ) : goals.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          No hay objetivos todavía.
          <br />
          <Button
            variant="link"
            className="mt-2"
            onClick={() => {
              setEditGoal(undefined);
              setFormOpen(true);
            }}
          >
            Crear el primero
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                En progreso ({active.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={() => {
                      setEditGoal(goal);
                      setFormOpen(true);
                    }}
                    onDelete={() => setDeleteId(goal.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Completados ({completed.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-70">
                {completed.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={() => {
                      setEditGoal(goal);
                      setFormOpen(true);
                    }}
                    onDelete={() => setDeleteId(goal.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <GoalForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditGoal(undefined);
        }}
        goal={editGoal}
      />

      <DeleteDialog
        open={deleteId != null}
        onOpenChange={(v) => !v && setDeleteId(null)}
        onConfirm={handleDelete}
        pending={del.isPending}
      />
    </div>
  );
}
