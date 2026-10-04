import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, Wallet } from "lucide-react";

import type { BalanceStatus } from "@/api/client";
import {
  useBalanceAdjustments,
  useDeleteBalanceAdjustment,
  useSetBalance,
} from "@/hooks/useBalance";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function formatSigned(amount: string): string {
  const num = parseFloat(amount);
  const abs = EUR.format(Math.abs(num));
  return num < 0 ? `-${abs}` : abs;
}

// ── Adjustment dialog ─────────────────────────────────────────────────────────

const balanceSchema = z.object({
  available: z
    .string()
    .min(1, "Obligatorio")
    .refine((v) => !isNaN(parseFloat(v.replace(",", "."))), "Importe inválido"),
  note: z.string().max(200).optional(),
});

type BalanceFormValues = z.infer<typeof balanceSchema>;

function BalanceDialog({
  open,
  onOpenChange,
  status,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  status: BalanceStatus;
}) {
  const setBalance = useSetBalance();
  const { data: adjustments = [] } = useBalanceAdjustments();
  const deleteAdjustment = useDeleteBalanceAdjustment();

  const form = useForm<BalanceFormValues>({
    resolver: zodResolver(balanceSchema),
    defaultValues: { available: status.available, note: "" },
  });

  async function onSubmit(values: BalanceFormValues) {
    try {
      await setBalance.mutateAsync({
        available: values.available.replace(",", "."),
        note: values.note?.trim() ? values.note.trim() : null,
      });
      toast.success("Saldo actualizado");
      onOpenChange(false);
    } catch {
      toast.error("No se pudo actualizar el saldo");
    }
  }

  async function onDelete(id: number) {
    try {
      await deleteAdjustment.mutateAsync(id);
      toast.success("Ajuste eliminado");
    } catch {
      toast.error("No se pudo eliminar el ajuste");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar saldo</DialogTitle>
          <DialogDescription>
            Indica el saldo que tienes realmente disponible. Se guarda la diferencia como un
            ajuste, sin crear ningún movimiento.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="available"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saldo disponible</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="0,00" {...field} />
                  </FormControl>
                  <FormDescription>
                    Ahora mismo: {formatSigned(status.available)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Efectivo en la cartera" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={setBalance.isPending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {adjustments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ajustes anteriores
              </p>
              <ul className="max-h-40 space-y-1 overflow-auto">
                {adjustments.map((adjustment) => (
                  <li
                    key={adjustment.id}
                    className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-sm"
                  >
                    <span
                      className={cn(
                        "w-24 shrink-0 tabular-nums",
                        parseFloat(adjustment.amount) < 0 ? "text-expense" : "text-income",
                      )}
                    >
                      {parseFloat(adjustment.amount) > 0 ? "+" : ""}
                      {formatSigned(adjustment.amount)}
                    </span>
                    <span className="flex-1 truncate text-muted-foreground">
                      {adjustment.note}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDate(adjustment.date)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Eliminar ajuste"
                      onClick={() => onDelete(adjustment.id)}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

export function BalanceKpiCard({ status }: { status: BalanceStatus | undefined }) {
  const [open, setOpen] = useState(false);

  if (!status) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs uppercase tracking-wide">Saldo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-28" />
        </CardContent>
      </Card>
    );
  }

  const available = parseFloat(status.available);
  const committed = parseFloat(status.committed_expense);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <CardDescription className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
            <Wallet className="h-3.5 w-3.5" />
            Saldo
          </CardDescription>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Ajustar saldo"
            onClick={() => setOpen(true)}
          >
            <Pencil />
          </Button>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "text-3xl font-bold tabular-nums",
              available >= 0 ? "text-income" : "text-expense",
            )}
          >
            {formatSigned(status.available)}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {committed > 0 ? (
              <>
                <span className="text-expense tabular-nums">-{EUR.format(committed)}</span>{" "}
                comprometidos
              </>
            ) : (
              "Disponible ahora mismo"
            )}
          </p>
        </CardContent>
      </Card>

      {open && <BalanceDialog open onOpenChange={setOpen} status={status} />}
    </>
  );
}
