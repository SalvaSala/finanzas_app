import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wand2, ToggleLeft, ToggleRight } from "lucide-react";

import type { CategorizationRuleRead, CategoryRead } from "@/api/client";
import {
  useCategorizationRules,
  useCreateCategorizationRule,
  useDeleteCategorizationRule,
  useUpdateCategorizationRule,
} from "@/hooks/useCategorizationRules";
import { useCategories } from "@/hooks/useCategories";

import { Badge } from "@/components/ui/badge";
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
  FormDescription,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCategoryName(categories: CategoryRead[], id: number): string {
  return categories.find((c) => c.id === id)?.name ?? String(id);
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  pattern: z.string().min(1, "Obligatorio").max(200),
  category_id: z.string().min(1, "Elige una categoría"),
  subcategory_id: z.string().optional(),
  priority: z.string().refine((v) => !isNaN(parseInt(v)), "Debe ser un número"),
});

type FormValues = z.infer<typeof schema>;

// ── Rule form dialog ──────────────────────────────────────────────────────────

function RuleForm({
  open,
  onOpenChange,
  rule,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule?: CategorizationRuleRead;
  categories: CategoryRead[];
}) {
  const create = useCreateCategorizationRule();
  const update = useUpdateCategorizationRule();
  const isEdit = !!rule;

  const parents = categories.filter((c) => c.parent_id == null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      pattern: rule?.pattern ?? "",
      category_id: rule ? String(rule.category_id) : "",
      subcategory_id: rule?.subcategory_id ? String(rule.subcategory_id) : "",
      priority: String(rule?.priority ?? 0),
    },
  });

  const watchCategoryId = form.watch("category_id");
  const children = watchCategoryId
    ? categories.filter((c) => c.parent_id === parseInt(watchCategoryId))
    : [];

  async function onSubmit(values: FormValues) {
    const payload = {
      pattern: values.pattern,
      category_id: parseInt(values.category_id),
      subcategory_id:
        values.subcategory_id && values.subcategory_id !== "__none"
          ? parseInt(values.subcategory_id)
          : null,
      priority: parseInt(values.priority),
    };
    try {
      if (isEdit && rule) {
        await update.mutateAsync({ id: rule.id, data: payload });
        toast.success("Regla actualizada");
      } else {
        await create.mutateAsync({ ...payload, enabled: true });
        toast.success("Regla creada");
      }
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar regla" : "Nueva regla"}</DialogTitle>
          <DialogDescription>
            Si el concepto contiene el texto indicado, se asignará la categoría
            automáticamente al crear el movimiento.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="pattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto a detectar</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: mercadona" {...field} />
                  </FormControl>
                  <FormDescription>Se busca dentro del concepto, sin distinguir mayúsculas.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("subcategory_id", "");
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Elige categoría…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {parents.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {children.length > 0 && (
              <FormField
                control={form.control}
                name="subcategory_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategoría (opcional)</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Ninguna" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none">Ninguna</SelectItem>
                        {children.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
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
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridad</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormDescription>
                    Menor número = mayor prioridad. Cuando hay varias coincidencias, gana la de menor prioridad.
                  </FormDescription>
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
          <DialogTitle>Eliminar regla</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar esta regla? Los movimientos ya creados no se modificarán.
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

// ── Rule row ──────────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  categories,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: CategorizationRuleRead;
  categories: CategoryRead[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const categoryName = getCategoryName(categories, rule.category_id);
  const subcategoryName = rule.subcategory_id
    ? getCategoryName(categories, rule.subcategory_id)
    : null;

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border bg-card px-4 py-3 ${
        rule.enabled ? "" : "opacity-50"
      }`}
    >
      <div className="min-w-[80px] text-center">
        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          P{rule.priority}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <span className="font-medium">"{rule.pattern}"</span>
        <span className="text-sm text-muted-foreground"> → </span>
        <span className="text-sm">
          {categoryName}
          {subcategoryName && (
            <span className="text-muted-foreground"> / {subcategoryName}</span>
          )}
        </span>
      </div>

      {!rule.enabled && (
        <Badge variant="outline" className="text-xs">
          Desactivada
        </Badge>
      )}

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggle}
          title={rule.enabled ? "Desactivar" : "Activar"}
        >
          {rule.enabled ? (
            <ToggleRight className="h-4 w-4 text-green-500" />
          ) : (
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CategorizationRulesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editRule, setEditRule] = useState<CategorizationRuleRead | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: rules = [], isLoading } = useCategorizationRules();
  const { data: categories = [] } = useCategories();
  const del = useDeleteCategorizationRule();
  const toggle = useUpdateCategorizationRule();

  async function handleDelete() {
    if (deleteId == null) return;
    try {
      await del.mutateAsync(deleteId);
      toast.success("Regla eliminada");
    } catch {
      toast.error("Error al eliminar la regla");
    } finally {
      setDeleteId(null);
    }
  }

  async function handleToggle(rule: CategorizationRuleRead) {
    try {
      await toggle.mutateAsync({ id: rule.id, data: { enabled: !rule.enabled } });
      toast.success(rule.enabled ? "Regla desactivada" : "Regla activada");
    } catch {
      toast.error("Error al cambiar el estado");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reglas de autocategorización</h1>
          <p className="text-sm text-muted-foreground">
            Cuando el concepto de un movimiento contiene el texto de una regla, se asigna la
            categoría automáticamente.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditRule(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva regla
        </Button>
      </div>

      <Separator />

      {isLoading ? (
        <div className="py-24 text-center text-muted-foreground">Cargando…</div>
      ) : rules.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          <Wand2 className="mx-auto mb-3 h-10 w-10 opacity-20" />
          <p>No hay reglas todavía.</p>
          <Button
            variant="link"
            className="mt-2"
            onClick={() => {
              setEditRule(undefined);
              setFormOpen(true);
            }}
          >
            Crear la primera regla
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              categories={categories}
              onEdit={() => {
                setEditRule(rule);
                setFormOpen(true);
              }}
              onDelete={() => setDeleteId(rule.id)}
              onToggle={() => handleToggle(rule)}
            />
          ))}
        </div>
      )}

      <RuleForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditRule(undefined);
        }}
        rule={editRule}
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
