import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";

import type { BudgetProgress, BudgetRead, CategoryRead } from "@/api/client";
import { useCategories } from "@/hooks/useCategories";
import {
  useBudgetProgress,
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
} from "@/hooks/useBudgets";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const now = new Date();

// ── Budget form ────────────────────────────────────────────────────────────

const schema = z.object({
  category_id: z.string().min(1, "Obligatorio"),
  amount: z
    .string()
    .min(1, "Obligatorio")
    .refine(
      (v) => /^\d+([.,]\d{1,2})?$/.test(v) && parseFloat(v.replace(",", ".")) > 0,
      "Importe inválido",
    ),
  period: z.enum(["monthly", "yearly"] as const),
});

type FormValues = z.infer<typeof schema>;

function BudgetForm({
  open,
  onOpenChange,
  budget,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  budget?: BudgetRead;
  categories: CategoryRead[];
}) {
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const isEdit = !!budget;

  const expenseCategories = categories.filter(
    (c) => c.type === "expense" && c.parent_id === null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category_id: budget?.category_id?.toString() ?? "",
      amount: budget?.amount ?? "",
      period: budget?.period ?? "monthly",
    },
  });

  async function onSubmit(values: FormValues) {
    const amount = values.amount.replace(",", ".");
    try {
      if (isEdit && budget) {
        await update.mutateAsync({ id: budget.id, data: { amount, period: values.period } });
        toast.success("Presupuesto actualizado");
      } else {
        await create.mutateAsync({
          category_id: parseInt(values.category_id),
          amount,
          period: values.period,
        });
        toast.success("Presupuesto creado");
      }
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      toast.error(msg.includes("Ya existe") ? "Ya hay un presupuesto para esa categoría" : msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar presupuesto" : "Nuevo presupuesto"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!isEdit && (
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría de gasto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {expenseCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Límite (€)</FormLabel>
                  <FormControl>
                    <Input placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Periodo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
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

// ── Budget progress card ───────────────────────────────────────────────────

function BudgetCard({
  progress,
  onEdit,
  onDelete,
}: {
  progress: BudgetProgress;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pct = Math.min(progress.percentage, 100);
  const exceeded = progress.exceeded;

  return (
    <Card className={exceeded ? "border-expense/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {progress.category_color && (
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: progress.category_color }}
              />
            )}
            <CardTitle className="text-base truncate">{progress.category_name}</CardTitle>
            {exceeded && <AlertTriangle className="h-4 w-4 shrink-0 text-expense" />}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-expense hover:text-expense"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${exceeded ? "bg-expense" : "bg-income"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Numbers */}
        <div className="flex justify-between text-sm">
          <span className={exceeded ? "text-expense font-medium" : "text-muted-foreground"}>
            {EUR.format(parseFloat(String(progress.spent)))} gastado
          </span>
          <span className="text-muted-foreground">
            de {EUR.format(parseFloat(String(progress.amount)))}
          </span>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress.period === "monthly" ? "Mensual" : "Anual"}</span>
          <span className={exceeded ? "text-expense font-medium" : ""}>
            {exceeded
              ? `+${EUR.format(Math.abs(parseFloat(String(progress.remaining))))} superado`
              : `${EUR.format(parseFloat(String(progress.remaining)))} restante`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Delete dialog ──────────────────────────────────────────────────────────

function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  const del = useDeleteBudget();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar presupuesto</DialogTitle>
          <DialogDescription>¿Seguro que quieres eliminar este presupuesto?</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={del.isPending}>
            {del.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function BudgetsPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(now.getMonth() + 1);
  const [formOpen, setFormOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<BudgetRead | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: progress = [], isLoading } = useBudgetProgress(year, month);
  const del = useDeleteBudget();

  function handleEdit(p: BudgetProgress) {
    setEditBudget({ id: p.id, category_id: p.category_id, amount: p.amount, period: p.period });
    setFormOpen(true);
  }

  async function handleDelete() {
    if (deleteId == null) return;
    try {
      await del.mutateAsync(deleteId);
      toast.success("Presupuesto eliminado");
    } catch {
      toast.error("Error al eliminar el presupuesto");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Presupuestos</h1>
          <p className="text-sm text-muted-foreground">
            Límites de gasto por categoría · {month ? `mes ${month} / ` : ""}
            {year}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditBudget(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo presupuesto
        </Button>
      </div>

      <PeriodSelector
        year={year}
        month={month}
        onYearChange={setYear}
        onMonthChange={setMonth}
      />

      <Separator />

      {isLoading ? (
        <div className="py-24 text-center text-muted-foreground">Cargando…</div>
      ) : progress.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          No hay presupuestos configurados.
          <br />
          <Button
            variant="link"
            className="mt-2"
            onClick={() => {
              setEditBudget(undefined);
              setFormOpen(true);
            }}
          >
            Crear el primero
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {progress.map((p) => (
            <BudgetCard
              key={p.id}
              progress={p}
              onEdit={() => handleEdit(p)}
              onDelete={() => setDeleteId(p.id)}
            />
          ))}
        </div>
      )}

      <BudgetForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditBudget(undefined);
        }}
        budget={editBudget}
        categories={categories}
      />

      <DeleteDialog
        open={deleteId != null}
        onOpenChange={(v) => !v && setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
