import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import type { AccountRead, CategoryRead, TagRead, TransactionRead } from "@/api/client";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/useTransactions";
import { useSetTransactionTags } from "@/hooks/useTags";
import { todayIso } from "@/lib/format";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

const schema = z
  .object({
    date: z.string().min(1, "Obligatorio"),
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
  })
  .refine(
    (v) =>
      v.type !== "transfer" ||
      (v.transfer_account_id && v.transfer_account_id !== v.account_id),
    {
      message: "Elige una cuenta destino distinta a la de origen",
      path: ["transfer_account_id"],
    },
  );

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionRead;
  duplicateFrom?: TransactionRead;
  accounts: AccountRead[];
  categories: CategoryRead[];
  tags?: TagRead[];
}

export function TransactionForm({
  open,
  onOpenChange,
  transaction,
  duplicateFrom,
  accounts,
  categories,
  tags = [],
}: Props) {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const setTags = useSetTransactionTags();
  const isEdit = !!transaction;
  const createAnotherRef = useRef(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    transaction?.tags?.map((t) => t.id) ?? [],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: todayIso(),
      type: "expense",
      concept: "",
      description: "",
      amount: "",
      account_id: accounts[0]?.id?.toString() ?? "",
      transfer_account_id: "",
      category_id: "",
      subcategory_id: "",
    },
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
      c.parent_id !== null &&
      selectedCategoryId &&
      c.parent_id === parseInt(selectedCategoryId),
  );

  useEffect(() => {
    if (open) {
      if (transaction) {
        form.reset({
          date: transaction.date,
          type: transaction.type as FormValues["type"],
          concept: transaction.concept,
          description: transaction.description ?? "",
          amount: transaction.amount,
          account_id: transaction.account_id.toString(),
          transfer_account_id: transaction.transfer_account_id?.toString() ?? "",
          category_id: transaction.category_id?.toString() ?? "",
          subcategory_id: transaction.subcategory_id?.toString() ?? "",
        });
        setSelectedTagIds(transaction.tags?.map((t) => t.id) ?? []);
      } else if (duplicateFrom) {
        form.reset({
          date: duplicateFrom.date,
          type: duplicateFrom.type as FormValues["type"],
          concept: duplicateFrom.concept,
          description: duplicateFrom.description ?? "",
          amount: duplicateFrom.amount,
          account_id: duplicateFrom.account_id.toString(),
          transfer_account_id: duplicateFrom.transfer_account_id?.toString() ?? "",
          category_id: duplicateFrom.category_id?.toString() ?? "",
          subcategory_id: duplicateFrom.subcategory_id?.toString() ?? "",
        });
        setSelectedTagIds(duplicateFrom.tags?.map((t) => t.id) ?? []);
      } else {
        form.reset({
          date: todayIso(),
          type: "expense",
          concept: "",
          description: "",
          amount: "",
          account_id: accounts[0]?.id?.toString() ?? "",
          transfer_account_id: "",
          category_id: "",
          subcategory_id: "",
        });
        setSelectedTagIds([]);
      }
    }
  }, [open, transaction, duplicateFrom, accounts, form]);

  // Reset category when type changes
  useEffect(() => {
    form.setValue("category_id", "");
    form.setValue("subcategory_id", "");
    form.setValue("transfer_account_id", "");
  }, [selectedType, form]);

  // Reset subcategory when category changes
  useEffect(() => {
    form.setValue("subcategory_id", "");
  }, [selectedCategoryId, form]);

  async function onSubmit(values: FormValues) {
    const amount = values.amount.replace(",", ".");

    const payload = isTransfer
      ? {
          date: values.date,
          type: "transfer" as const,
          concept: values.concept,
          description: values.description || null,
          amount,
          account_id: parseInt(values.account_id),
          transfer_account_id: parseInt(values.transfer_account_id!),
          category_id: null,
          subcategory_id: null,
        }
      : {
          date: values.date,
          type: values.type as "income" | "expense",
          concept: values.concept,
          description: values.description || null,
          amount,
          account_id: parseInt(values.account_id),
          transfer_account_id: null,
          category_id: values.category_id ? parseInt(values.category_id) : null,
          subcategory_id: values.subcategory_id ? parseInt(values.subcategory_id) : null,
        };

    try {
      let txId: number;
      if (isEdit && transaction) {
        const updated = await update.mutateAsync({ id: transaction.id, data: payload });
        txId = updated.id;
        toast.success("Movimiento actualizado");
      } else {
        const created = await create.mutateAsync(payload);
        txId = created.id;
        toast.success("Movimiento creado");
      }
      await setTags.mutateAsync({ transactionId: txId, tagIds: selectedTagIds });
      if (createAnotherRef.current) {
        createAnotherRef.current = false;
        form.reset({
          date: values.date,
          type: values.type,
          concept: "",
          description: "",
          amount: "",
          account_id: values.account_id,
          transfer_account_id: "",
          category_id: "",
          subcategory_id: "",
        });
        setSelectedTagIds([]);
        form.setFocus("concept");
      } else {
        onOpenChange(false);
      }
    } catch {
      createAnotherRef.current = false;
      toast.error("Error al guardar el movimiento");
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar movimiento" : duplicateFrom ? "Duplicar movimiento" : "Nuevo movimiento"}
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
                  <Select onValueChange={field.onChange} value={field.value}>
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

            {/* Date + Amount */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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

            {/* Concept */}
            <FormField
              control={form.control}
              name="concept"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Concepto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Supermercado Mercadona" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Detalles adicionales…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            {tags.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium leading-none">Etiquetas</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setSelectedTagIds((prev) =>
                            active ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                          )
                        }
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity"
                        style={
                          tag.color
                            ? {
                                backgroundColor: active ? `${tag.color}33` : `${tag.color}11`,
                                color: tag.color,
                                border: `1px solid ${tag.color}${active ? "88" : "33"}`,
                                opacity: active ? 1 : 0.6,
                              }
                            : {
                                backgroundColor: active ? "hsl(var(--accent))" : "transparent",
                                border: "1px solid hsl(var(--border))",
                              }
                        }
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              {!isEdit && (
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => { createAnotherRef.current = true; }}
                >
                  {isPending && createAnotherRef.current ? "Guardando…" : "Guardar y crear otro"}
                </Button>
              )}
              <Button
                type="submit"
                disabled={isPending}
                onClick={() => { createAnotherRef.current = false; }}
              >
                {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear movimiento"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
