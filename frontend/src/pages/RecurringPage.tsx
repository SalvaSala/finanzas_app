import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Play, Pause, RefreshCw, Repeat } from "lucide-react";

import type {
  AccountRead,
  CategoryRead,
  RecurrenceFrequency,
  RecurringRead,
  TransactionRead,
} from "@/api/client";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import {
  useCreateRecurring,
  useDeleteRecurring,
  useRecurring,
  useRunRecurring,
  useUpdateRecurring,
} from "@/hooks/useRecurring";
import { formatAmount, formatDate, todayIso } from "@/lib/format";

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

// ── Helpers ──────────────────────────────────────────────────────────────────

const FREQ_LABEL: Record<RecurrenceFrequency, [string, string]> = {
  daily: ["día", "días"],
  weekly: ["semana", "semanas"],
  monthly: ["mes", "meses"],
  yearly: ["año", "años"],
};

function describeFrequency(freq: RecurrenceFrequency, interval: number): string {
  const [singular, plural] = FREQ_LABEL[freq];
  return interval === 1 ? `Cada ${singular}` : `Cada ${interval} ${plural}`;
}

// ── Form ─────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    type: z.enum(["income", "expense", "transfer"] as const),
    concept: z.string().min(1, "Obligatorio").max(200),
    description: z.string().optional(),
    amount: z
      .string()
      .min(1, "Obligatorio")
      .refine(
        (v) => /^\d+([.,]\d{1,2})?$/.test(v) && parseFloat(v.replace(",", ".")) > 0,
        "Importe inválido (ej: 12.50)",
      ),
    account_id: z.string().min(1, "Obligatorio"),
    transfer_account_id: z.string().optional(),
    category_id: z.string().optional(),
    subcategory_id: z.string().optional(),
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"] as const),
    interval: z
      .string()
      .min(1, "Obligatorio")
      .refine((v) => /^\d+$/.test(v) && parseInt(v) > 0, "Debe ser un número mayor que 0"),
    start_date: z.string().min(1, "Obligatorio"),
    end_date: z.string().optional(),
  })
  .refine(
    (v) =>
      v.type !== "transfer" ||
      (v.transfer_account_id && v.transfer_account_id !== v.account_id),
    { message: "Elige una cuenta destino distinta a la de origen", path: ["transfer_account_id"] },
  )
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    message: "La fecha de fin no puede ser anterior a la de inicio",
    path: ["end_date"],
  });

type FormValues = z.infer<typeof schema>;

function emptyDefaults(accounts: AccountRead[]): FormValues {
  return {
    type: "expense",
    concept: "",
    description: "",
    amount: "",
    account_id: accounts[0]?.id?.toString() ?? "",
    transfer_account_id: "",
    category_id: "",
    subcategory_id: "",
    frequency: "monthly",
    interval: "1",
    start_date: todayIso(),
    end_date: "",
  };
}

function RecurringForm({
  open,
  onOpenChange,
  recurring,
  fromTransaction,
  accounts,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recurring?: RecurringRead;
  fromTransaction?: TransactionRead;
  accounts: AccountRead[];
  categories: CategoryRead[];
}) {
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const isEdit = !!recurring;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults(accounts),
  });

  const selectedType = form.watch("type");
  const selectedCategoryId = form.watch("category_id");
  const selectedAccountId = form.watch("account_id");
  const isTransfer = selectedType === "transfer";

  const parentCategories = categories.filter(
    (c) => c.type === selectedType && c.parent_id === null,
  );
  const subcategories = categories.filter(
    (c) =>
      c.parent_id !== null && selectedCategoryId && c.parent_id === parseInt(selectedCategoryId),
  );

  useEffect(() => {
    if (!open) return;
    if (recurring) {
      form.reset({
        type: recurring.type as FormValues["type"],
        concept: recurring.concept,
        description: recurring.description ?? "",
        amount: recurring.amount,
        account_id: recurring.account_id.toString(),
        transfer_account_id: recurring.transfer_account_id?.toString() ?? "",
        category_id: recurring.category_id?.toString() ?? "",
        subcategory_id: recurring.subcategory_id?.toString() ?? "",
        frequency: recurring.frequency,
        interval: recurring.interval.toString(),
        start_date: recurring.start_date,
        end_date: recurring.end_date ?? "",
      });
    } else if (fromTransaction) {
      form.reset({
        type: fromTransaction.type as FormValues["type"],
        concept: fromTransaction.concept,
        description: fromTransaction.description ?? "",
        amount: fromTransaction.amount,
        account_id: fromTransaction.account_id.toString(),
        transfer_account_id: fromTransaction.transfer_account_id?.toString() ?? "",
        category_id: fromTransaction.category_id?.toString() ?? "",
        subcategory_id: fromTransaction.subcategory_id?.toString() ?? "",
        frequency: "monthly",
        interval: "1",
        start_date: todayIso(),
        end_date: "",
      });
    } else {
      form.reset(emptyDefaults(accounts));
    }
  }, [open, recurring, fromTransaction, accounts, form]);

  async function onSubmit(values: FormValues) {
    const amount = values.amount.replace(",", ".");
    const interval = parseInt(values.interval);
    const end_date = values.end_date || null;

    try {
      if (isEdit && recurring) {
        // `type` is immutable on the server; we omit it from the update payload.
        await update.mutateAsync({
          id: recurring.id,
          data: {
            concept: values.concept,
            description: values.description || null,
            amount,
            account_id: parseInt(values.account_id),
            transfer_account_id: isTransfer ? parseInt(values.transfer_account_id!) : null,
            category_id: isTransfer || !values.category_id ? null : parseInt(values.category_id),
            subcategory_id:
              isTransfer || !values.subcategory_id ? null : parseInt(values.subcategory_id),
            frequency: values.frequency,
            interval,
            start_date: values.start_date,
            end_date,
          },
        });
        toast.success("Recurrencia actualizada");
      } else {
        const base = {
          type: values.type,
          concept: values.concept,
          description: values.description || null,
          amount,
          account_id: parseInt(values.account_id),
          frequency: values.frequency,
          interval,
          start_date: values.start_date,
          end_date,
        };
        const payload = isTransfer
          ? {
              ...base,
              type: "transfer" as const,
              transfer_account_id: parseInt(values.transfer_account_id!),
              category_id: null,
              subcategory_id: null,
            }
          : {
              ...base,
              type: values.type as "income" | "expense",
              transfer_account_id: null,
              category_id: values.category_id ? parseInt(values.category_id) : null,
              subcategory_id: values.subcategory_id ? parseInt(values.subcategory_id) : null,
            };
        await create.mutateAsync(payload);
        toast.success("Recurrencia creada");
      }
      onOpenChange(false);
    } catch {
      toast.error("Error al guardar la recurrencia");
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar recurrencia" : fromTransaction ? "Crear recurrencia desde movimiento" : "Nueva recurrencia"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="expense">Gasto</SelectItem>
                      <SelectItem value="income">Ingreso</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Concept + Amount */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="concept"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Concepto</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Alquiler" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Importe (€)</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Source account */}
            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isTransfer ? "Cuenta origen" : "Cuenta"}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una cuenta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id.toString()}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Destination account (transfer only) */}
            {isTransfer && (
              <FormField
                control={form.control}
                name="transfer_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta destino</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts
                          .filter((a) => a.id.toString() !== selectedAccountId)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id.toString()}>
                              {a.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Category + Subcategory (not for transfers) */}
            {!isTransfer && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parentCategories.map((c) => (
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
                <FormField
                  control={form.control}
                  name="subcategory_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subcategoría</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={subcategories.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin subcategoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subcategories.map((c) => (
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
              </div>
            )}

            <Separator />

            {/* Frequency + interval */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frecuencia</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Diaria</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensual</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cada</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Start + end dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de inicio</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de fin (opcional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear recurrencia"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function RecurringCard({
  recurring,
  onEdit,
  onDelete,
  onToggle,
}: {
  recurring: RecurringRead;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const amountClass =
    recurring.type === "income"
      ? "text-income"
      : recurring.type === "expense"
        ? "text-expense"
        : "text-muted-foreground";

  return (
    <Card className={recurring.active ? "" : "opacity-60"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{recurring.concept}</CardTitle>
            <p className={`text-lg font-semibold ${amountClass}`}>
              {formatAmount(recurring.amount, recurring.type)}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={recurring.active ? "Pausar" : "Reanudar"}
              onClick={onToggle}
            >
              {recurring.active ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
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
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Repeat className="h-3.5 w-3.5 shrink-0" />
          <span>{describeFrequency(recurring.frequency, recurring.interval)}</span>
        </div>
        <p>
          {recurring.active ? (
            <>Próximo: {formatDate(recurring.next_run_date)}</>
          ) : (
            <span className="text-muted-foreground">Pausada</span>
          )}
        </p>
        {recurring.end_date && <p className="text-xs">Hasta {formatDate(recurring.end_date)}</p>}
      </CardContent>
    </Card>
  );
}

// ── Delete dialog ────────────────────────────────────────────────────────────

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
          <DialogTitle>Eliminar recurrencia</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar esta recurrencia? Los movimientos ya generados se
            conservan.
          </DialogDescription>
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

// ── Page ─────────────────────────────────────────────────────────────────────

export function RecurringPage() {
  const location = useLocation();
  const locationState = location.state as { fromTransaction?: TransactionRead } | null;

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecurringRead | undefined>();
  const [fromTransaction, setFromTransaction] = useState<TransactionRead | undefined>(
    locationState?.fromTransaction,
  );
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const openedFromNav = useRef(false);
  useEffect(() => {
    if (locationState?.fromTransaction && !openedFromNav.current) {
      openedFromNav.current = true;
      setFormOpen(true);
    }
  }, [locationState]);

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: items = [], isLoading } = useRecurring();
  const update = useUpdateRecurring();
  const del = useDeleteRecurring();
  const run = useRunRecurring();

  async function handleToggle(item: RecurringRead) {
    try {
      await update.mutateAsync({ id: item.id, data: { active: !item.active } });
      toast.success(item.active ? "Recurrencia pausada" : "Recurrencia reanudada");
    } catch {
      toast.error("Error al actualizar la recurrencia");
    }
  }

  async function handleDelete() {
    if (deleteId == null) return;
    try {
      await del.mutateAsync(deleteId);
      toast.success("Recurrencia eliminada");
    } catch {
      toast.error("Error al eliminar la recurrencia");
    } finally {
      setDeleteId(null);
    }
  }

  async function handleRun() {
    try {
      const result = await run.mutateAsync();
      toast.success(
        result.generated === 0
          ? "No había movimientos pendientes"
          : `${result.generated} movimiento(s) generado(s)`,
      );
    } catch {
      toast.error("Error al generar los movimientos");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recurrentes</h1>
          <p className="text-sm text-muted-foreground">
            Plantillas que generan movimientos automáticamente
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRun} disabled={run.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {run.isPending ? "Generando…" : "Generar ahora"}
          </Button>
          <Button
            onClick={() => {
              setEditItem(undefined);
              setFromTransaction(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva recurrencia
          </Button>
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <div className="py-24 text-center text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          No hay recurrencias configuradas.
          <br />
          <Button
            variant="link"
            className="mt-2"
            onClick={() => {
              setEditItem(undefined);
              setFromTransaction(undefined);
              setFormOpen(true);
            }}
          >
            Crear la primera
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <RecurringCard
              key={item.id}
              recurring={item}
              onEdit={() => {
                setEditItem(item);
                setFromTransaction(undefined);
                setFormOpen(true);
              }}
              onDelete={() => setDeleteId(item.id)}
              onToggle={() => handleToggle(item)}
            />
          ))}
        </div>
      )}

      <RecurringForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) {
            setEditItem(undefined);
            setFromTransaction(undefined);
          }
        }}
        recurring={editItem}
        fromTransaction={fromTransaction}
        accounts={accounts}
        categories={categories}
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
