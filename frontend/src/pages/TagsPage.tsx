import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";

import type { TagRead } from "@/api/client";
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "@/hooks/useTags";

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
import { Separator } from "@/components/ui/separator";

// ── Preset colors ─────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#ef4444", // red
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#64748b", // slate
];

// ── Form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Obligatorio").max(50),
  color: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function TagForm({
  open,
  onOpenChange,
  tag,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tag?: TagRead;
}) {
  const create = useCreateTag();
  const update = useUpdateTag();
  const isEdit = !!tag;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: tag?.name ?? "", color: tag?.color ?? "" },
  });

  const watchColor = form.watch("color");

  async function onSubmit(values: FormValues) {
    const color = values.color || null;
    try {
      if (isEdit && tag) {
        await update.mutateAsync({ id: tag.id, data: { name: values.name, color } });
        toast.success("Etiqueta actualizada");
      } else {
        await create.mutateAsync({ name: values.name, color });
        toast.success("Etiqueta creada");
      }
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      toast.error(msg.includes("Ya existe") ? "Ya hay una etiqueta con ese nombre" : msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar etiqueta" : "Nueva etiqueta"}</DialogTitle>
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
                    <Input placeholder="Ej: vacaciones" {...field} />
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
                  <div className="space-y-2">
                    {/* Preset swatches */}
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor: field.value === c ? "hsl(var(--foreground))" : "transparent",
                          }}
                          onClick={() => field.onChange(c)}
                        />
                      ))}
                      {/* Clear color */}
                      <button
                        type="button"
                        className="h-6 w-6 rounded-full border border-dashed border-muted-foreground text-muted-foreground text-xs hover:opacity-70"
                        onClick={() => field.onChange("")}
                        title="Sin color"
                      >
                        ✕
                      </button>
                    </div>
                    {/* Custom hex input */}
                    <FormControl>
                      <Input placeholder="#hexcode" {...field} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            {form.getValues("name") && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Vista previa:</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={
                    watchColor
                      ? {
                          backgroundColor: `${watchColor}22`,
                          color: watchColor,
                          border: `1px solid ${watchColor}55`,
                        }
                      : { border: "1px solid hsl(var(--border))" }
                  }
                >
                  <Tag className="h-3 w-3" />
                  {form.watch("name")}
                </span>
              </div>
            )}

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
          <DialogTitle>Eliminar etiqueta</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar esta etiqueta? Se quitará de todos los movimientos que la
            tengan.
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

// ── Page ──────────────────────────────────────────────────────────────────────

export function TagsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTag, setEditTag] = useState<TagRead | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: tags = [], isLoading } = useTags();
  const del = useDeleteTag();

  async function handleDelete() {
    if (deleteId == null) return;
    try {
      await del.mutateAsync(deleteId);
      toast.success("Etiqueta eliminada");
    } catch {
      toast.error("Error al eliminar la etiqueta");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Etiquetas</h1>
          <p className="text-sm text-muted-foreground">
            Clasifica movimientos con etiquetas libres (vacaciones, deducible…)
          </p>
        </div>
        <Button
          onClick={() => {
            setEditTag(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva etiqueta
        </Button>
      </div>

      <Separator />

      {isLoading ? (
        <div className="py-24 text-center text-muted-foreground">Cargando…</div>
      ) : tags.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          No hay etiquetas todavía.
          <br />
          <Button
            variant="link"
            className="mt-2"
            onClick={() => {
              setEditTag(undefined);
              setFormOpen(true);
            }}
          >
            Crear la primera
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5"
            >
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium"
                style={
                  tag.color
                    ? {
                        backgroundColor: `${tag.color}22`,
                        color: tag.color,
                        border: `1px solid ${tag.color}44`,
                      }
                    : { border: "1px solid hsl(var(--border))" }
                }
              >
                <Tag className="h-3 w-3" />
                {tag.name}
              </span>
              <div className="flex gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setEditTag(tag);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-expense hover:text-expense"
                  onClick={() => setDeleteId(tag.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TagForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditTag(undefined);
        }}
        tag={editTag}
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
