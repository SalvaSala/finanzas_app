import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { useCategories, useCategoryMutations } from "@/hooks/useCategories";
import type { CategoryRead, CategoryCreate, CategoryUpdate, CategoryType } from "@/api/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Color swatches ────────────────────────────────────────────────────────────

const SWATCHES = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
  "#64748b", "#78716c",
];

// ── Category form dialog ──────────────────────────────────────────────────────

interface DialogState {
  mode: "create-parent" | "create-sub" | "edit";
  category?: CategoryRead;
  parentId?: number;
  parentName?: string;
  type: CategoryType;
}

interface CategoryFormProps {
  state: DialogState;
  onClose: () => void;
  onSave: (data: CategoryCreate | CategoryUpdate) => void;
  saving: boolean;
}

function CategoryForm({ state, onClose, onSave, saving }: CategoryFormProps) {
  const initial =
    state.mode === "edit"
      ? { name: state.category!.name, color: state.category!.color ?? "", icon: state.category!.icon ?? "" }
      : { name: "", color: SWATCHES[0], icon: "" };

  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [icon, setIcon] = useState(initial.icon);

  const title =
    state.mode === "edit"
      ? `Editar "${state.category!.name}"`
      : state.mode === "create-sub"
        ? `Nueva subcategoría en "${state.parentName}"`
        : state.type === "expense"
          ? "Nueva categoría de gasto"
          : "Nueva categoría de ingreso";

  function handleSave() {
    if (!name.trim()) return;
    if (state.mode === "edit") {
      onSave({ name: name.trim(), color: color || null, icon: icon.trim() || null } as CategoryUpdate);
    } else {
      onSave({
        name: name.trim(),
        type: state.type,
        parent_id: state.parentId ?? null,
        color: color || null,
        icon: icon.trim() || null,
      } as CategoryCreate);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Nombre</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la categoría"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="h-7 w-7 rounded-full ring-offset-2 transition-all"
                  style={{
                    backgroundColor: s,
                    outline: color === s ? `2px solid ${s}` : "none",
                    outlineOffset: "2px",
                  }}
                  onClick={() => setColor(s)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-icon">Icono (emoji, opcional)</Label>
            <Input
              id="cat-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🍔"
              className="w-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Category list for one type ────────────────────────────────────────────────

interface CategoryListProps {
  type: CategoryType;
}

function CategoryList({ type }: CategoryListProps) {
  const { data: categories = [] } = useCategories();
  const { create, update, remove } = useCategoryMutations();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRead | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const parents = categories.filter((c) => c.type === type && c.parent_id === null);
  const childrenOf = (parentId: number) =>
    categories.filter((c) => c.type === type && c.parent_id === parentId);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function handleSave(data: CategoryCreate | CategoryUpdate) {
    if (!dialog) return;
    if (dialog.mode === "edit") {
      update.mutate(
        { id: dialog.category!.id, data: data as CategoryUpdate },
        {
          onSuccess: () => { toast.success("Categoría actualizada"); setDialog(null); },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else {
      create.mutate(data as CategoryCreate, {
        onSuccess: () => { toast.success("Categoría creada"); setDialog(null); },
        onError: (e) => toast.error((e as Error).message),
      });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => { toast.success("Categoría eliminada"); setDeleteTarget(null); },
      onError: (e) => { toast.error((e as Error).message); setDeleteTarget(null); },
    });
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setDialog({ mode: "create-parent", type })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      {parents.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Sin categorías. Crea la primera.
        </p>
      )}

      <ul className="space-y-2">
        {parents.map((parent) => {
          const subs = childrenOf(parent.id);
          const isExpanded = expanded.has(parent.id);

          return (
            <li key={parent.id} className="rounded-lg border bg-card">
              {/* Parent row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {subs.length > 0 && (
                  <button
                    onClick={() => toggleExpand(parent.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </button>
                )}
                {subs.length === 0 && <span className="w-4" />}

                {parent.color && (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: parent.color }}
                  />
                )}
                {parent.icon && <span className="text-base leading-none">{parent.icon}</span>}
                <span className="flex-1 font-medium">{parent.name}</span>
                <span className="text-xs text-muted-foreground">
                  {subs.length > 0 ? `${subs.length} subcategorías` : ""}
                </span>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setDialog({ mode: "edit", category: parent, type })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(parent)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Subcategories */}
              {isExpanded && (
                <ul className="border-t">
                  {subs.map((sub) => (
                    <li
                      key={sub.id}
                      className="flex items-center gap-3 border-b px-4 py-2.5 pl-10 last:border-b-0"
                    >
                      {sub.color && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: sub.color }}
                        />
                      )}
                      {sub.icon && <span className="text-sm leading-none">{sub.icon}</span>}
                      <span className="flex-1 text-sm">{sub.name}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setDialog({ mode: "edit", category: sub, type })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(sub)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                  <li className="px-4 py-2 pl-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() =>
                        setDialog({
                          mode: "create-sub",
                          type,
                          parentId: parent.id,
                          parentName: parent.name,
                        })
                      }
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Nueva subcategoría
                    </Button>
                  </li>
                </ul>
              )}

              {/* Show subcategory button even when collapsed, if no subs yet */}
              {!isExpanded && subs.length === 0 && (
                <div className="border-t px-4 py-2 pl-10">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() =>
                      setDialog({
                        mode: "create-sub",
                        type,
                        parentId: parent.id,
                        parentName: parent.name,
                      })
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Nueva subcategoría
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {dialog && (
        <CategoryForm
          state={dialog}
          onClose={() => setDialog(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "expense" | "income";

export function CategoriesPage() {
  const [tab, setTab] = useState<Tab>("expense");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona las categorías y subcategorías de tus movimientos
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1 w-fit">
        {(["expense", "income"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "expense" ? "Gastos" : "Ingresos"}
          </button>
        ))}
      </div>

      <CategoryList key={tab} type={tab} />
    </div>
  );
}
