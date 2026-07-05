import { X, Search, ChevronRight, Check } from "lucide-react";

import type { AccountRead, CategoryRead, ListTransactionsQuery, TagRead } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

interface Props {
  filters: ListTransactionsQuery;
  onChange: (f: ListTransactionsQuery) => void;
  accounts: AccountRead[];
  categories: CategoryRead[];
  tags?: TagRead[];
}

const ALL = "__all__";

export function TransactionFilters({ filters, onChange, accounts, categories, tags = [] }: Props) {
  const parentCategories = categories.filter((c) => c.parent_id === null);

  function subcategoriesOf(parentId: number) {
    return categories.filter((c) => c.parent_id === parentId);
  }

  const hasActiveFilters =
    filters.search ||
    filters.type ||
    filters.category_id != null ||
    filters.subcategory_id != null ||
    filters.no_category ||
    filters.no_subcategory ||
    filters.account_id != null ||
    filters.tag_id != null;

  function clear() {
    onChange({ year: filters.year, month: filters.month, limit: filters.limit });
  }

  const categoryLabel = (() => {
    if (filters.no_category) return "Sin categoría";
    if (filters.no_subcategory) return "Sin subcategoría";
    if (filters.subcategory_id != null) {
      const cat = categories.find((c) => c.id === filters.subcategory_id);
      return cat?.name ?? "Categoría";
    }
    if (filters.category_id != null) {
      const cat = categories.find((c) => c.id === filters.category_id);
      return cat?.name ?? "Categoría";
    }
    return "Categoría";
  })();

  function selectParent(catId: number) {
    onChange({
      ...filters,
      category_id: catId,
      subcategory_id: undefined,
      no_category: undefined,
      no_subcategory: undefined,
    });
  }

  function selectSubcategory(subId: number) {
    onChange({
      ...filters,
      category_id: undefined,
      subcategory_id: subId,
      no_category: undefined,
      no_subcategory: undefined,
    });
  }

  function selectNoneCat() {
    onChange({
      ...filters,
      category_id: undefined,
      subcategory_id: undefined,
      no_category: true,
      no_subcategory: undefined,
    });
  }

  function selectNoneSubcat() {
    onChange({
      ...filters,
      category_id: undefined,
      subcategory_id: undefined,
      no_category: undefined,
      no_subcategory: true,
    });
  }

  function selectAll() {
    onChange({
      ...filters,
      category_id: undefined,
      subcategory_id: undefined,
      no_category: undefined,
      no_subcategory: undefined,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-48 flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8 h-9"
          placeholder="Buscar concepto…"
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      {/* Type */}
      <Select
        value={filters.type ?? ALL}
        onValueChange={(v) => onChange({ ...filters, type: v === ALL ? undefined : (v as ListTransactionsQuery["type"]) })}
      >
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los tipos</SelectItem>
          <SelectItem value="income">Ingresos</SelectItem>
          <SelectItem value="expense">Gastos</SelectItem>
          <SelectItem value="transfer">Transferencias</SelectItem>
        </SelectContent>
      </Select>

      {/* Category — nested dropdown with subcategories */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-9 w-44 items-center justify-between gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[placeholder]:text-muted-foreground aria-invalid:border-destructive"
        >
          <span className="truncate">{categoryLabel}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-44">
          <DropdownMenuItem onClick={selectAll}>
            {filters.category_id == null && filters.subcategory_id == null && !filters.no_category && !filters.no_subcategory && (
              <Check className="mr-1 h-3.5 w-3.5" />
            )}
            <span className={filters.category_id == null && filters.subcategory_id == null && !filters.no_category && !filters.no_subcategory ? "" : "ml-5"}>
              Todas las categorías
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={selectNoneCat}>
            {filters.no_category && <Check className="mr-1 h-3.5 w-3.5" />}
            <span className={filters.no_category ? "" : "ml-5"}>Sin categoría</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={selectNoneSubcat}>
            {filters.no_subcategory && <Check className="mr-1 h-3.5 w-3.5" />}
            <span className={filters.no_subcategory ? "" : "ml-5"}>Sin subcategoría</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {parentCategories.map((cat) => {
            const subs = subcategoriesOf(cat.id);
            const isSelected = filters.category_id === cat.id;
            const hasSubSelected = filters.subcategory_id != null && subs.some((s) => s.id === filters.subcategory_id);

            if (subs.length === 0) {
              return (
                <DropdownMenuItem key={cat.id} onClick={() => selectParent(cat.id)}>
                  {isSelected && <Check className="mr-1 h-3.5 w-3.5" />}
                  <span className={isSelected ? "" : "ml-5"}>{cat.name}</span>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuSub key={cat.id}>
                <DropdownMenuSubTrigger
                  className={isSelected || hasSubSelected ? "bg-accent font-medium" : ""}
                  onClick={() => selectParent(cat.id)}
                >
                  {isSelected && !hasSubSelected && <Check className="mr-1 h-3.5 w-3.5" />}
                  <span className={(isSelected && !hasSubSelected) ? "" : "ml-5"}>{cat.name}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => selectParent(cat.id)}>
                    {isSelected && !hasSubSelected && <Check className="mr-1 h-3.5 w-3.5" />}
                    <span className={(isSelected && !hasSubSelected) ? "font-medium" : ""}>
                      Todas las de {cat.name}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {subs.map((sub) => (
                    <DropdownMenuItem key={sub.id} onClick={() => selectSubcategory(sub.id)}>
                      {filters.subcategory_id === sub.id && <Check className="mr-1 h-3.5 w-3.5" />}
                      <span className={filters.subcategory_id === sub.id ? "" : "ml-5"}>{sub.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Account */}
      <Select
        value={filters.account_id != null ? String(filters.account_id) : ALL}
        onValueChange={(v) =>
          onChange({ ...filters, account_id: v === ALL ? undefined : parseInt(v) })
        }
      >
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder="Cuenta" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las cuentas</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={String(a.id)}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tag */}
      {tags.length > 0 && (
        <Select
          value={filters.tag_id != null ? String(filters.tag_id) : ALL}
          onValueChange={(v) =>
            onChange({ ...filters, tag_id: v === ALL ? undefined : parseInt(v) })
          }
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Etiqueta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las etiquetas</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={clear}>
          <X className="h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
