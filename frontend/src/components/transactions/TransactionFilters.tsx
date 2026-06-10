import { X, Search } from "lucide-react";

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

  const hasActiveFilters =
    filters.search ||
    filters.type ||
    filters.category_id != null ||
    filters.account_id != null ||
    filters.tag_id != null;

  function clear() {
    onChange({ year: filters.year, month: filters.month, limit: filters.limit });
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

      {/* Category */}
      <Select
        value={filters.category_id != null ? String(filters.category_id) : ALL}
        onValueChange={(v) =>
          onChange({ ...filters, category_id: v === ALL ? undefined : parseInt(v) })
        }
      >
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las categorías</SelectItem>
          {parentCategories.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
