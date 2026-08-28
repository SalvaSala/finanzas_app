import type { AccountRead, CategoryRead, ListTransactionsQuery, TagRead } from "@/api/client";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TransactionFilters } from "./TransactionFilters";

const accounts = [
  { id: 1, name: "Banco", type: "bank" },
  { id: 2, name: "Efectivo", type: "cash" },
] as AccountRead[];

const categories = [
  { id: 10, name: "Alimentación", type: "expense", parent_id: null },
  { id: 11, name: "Supermercado", type: "expense", parent_id: 10 },
  { id: 12, name: "Restaurantes", type: "expense", parent_id: 10 },
  { id: 20, name: "Ocio", type: "expense", parent_id: null },
] as CategoryRead[];

const tags = [{ id: 5, name: "vacaciones", color: null }] as TagRead[];

/** El periodo seleccionado no forma parte de los filtros que se limpian. */
const PERIOD: ListTransactionsQuery = { year: 2026, month: 6 };

function setup(filters: ListTransactionsQuery = PERIOD, withTags = false) {
  const onChange = vi.fn();
  render(
    <TransactionFilters
      filters={filters}
      onChange={onChange}
      accounts={accounts}
      categories={categories}
      tags={withTags ? tags : []}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

describe("TransactionFilters — búsqueda", () => {
  it("propaga el texto escrito", async () => {
    const { onChange, user } = setup();

    await user.type(screen.getByPlaceholderText("Buscar concepto…"), "c");

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: "c" }));
  });

  it("convierte la búsqueda vacía en undefined para no mandarla", async () => {
    const { onChange, user } = setup({ ...PERIOD, search: "café" });

    await user.clear(screen.getByPlaceholderText("Buscar concepto…"));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }));
  });

  it("muestra el valor actual del filtro", () => {
    setup({ ...PERIOD, search: "café" });
    expect(screen.getByPlaceholderText("Buscar concepto…")).toHaveValue("café");
  });
});

describe("TransactionFilters — categorías anidadas", () => {
  it("por defecto muestra la etiqueta genérica", () => {
    setup();
    expect(screen.getByText("Categoría")).toBeInTheDocument();
  });

  it("muestra el nombre de la categoría seleccionada", () => {
    setup({ ...PERIOD, category_id: 10 });
    expect(screen.getByText("Alimentación")).toBeInTheDocument();
  });

  it("muestra el nombre de la subcategoría seleccionada", () => {
    setup({ ...PERIOD, subcategory_id: 11 });
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
  });

  it("etiqueta el filtro 'sin categoría'", () => {
    setup({ ...PERIOD, no_category: true });
    expect(screen.getByText("Sin categoría")).toBeInTheDocument();
  });

  it("etiqueta el filtro 'sin subcategoría'", () => {
    setup({ ...PERIOD, no_subcategory: true });
    expect(screen.getByText("Sin subcategoría")).toBeInTheDocument();
  });

  it("seleccionar una categoría sin hijos limpia los demás filtros de categoría", async () => {
    const { onChange, user } = setup({ ...PERIOD, no_category: true });

    await user.click(screen.getByText("Sin categoría"));
    await user.click(await screen.findByText("Ocio"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: 20,
        subcategory_id: undefined,
        no_category: undefined,
        no_subcategory: undefined,
      }),
    );
  });

  it("'Todas las categorías' limpia la selección pero conserva el periodo", async () => {
    const { onChange, user } = setup({ ...PERIOD, category_id: 10 });

    await user.click(screen.getByText("Alimentación"));
    await user.click(await screen.findByText("Todas las categorías"));

    expect(onChange).toHaveBeenCalledWith({
      year: 2026,
      month: 6,
      category_id: undefined,
      subcategory_id: undefined,
      no_category: undefined,
      no_subcategory: undefined,
    });
  });
});

describe("TransactionFilters — cuenta y etiqueta", () => {
  it("no muestra el selector de etiquetas si no hay etiquetas", () => {
    setup();
    expect(screen.queryByText("Todas las etiquetas")).not.toBeInTheDocument();
  });

  it("muestra el selector de etiquetas cuando las hay", () => {
    setup(PERIOD, true);
    // Sin etiqueta filtrada el selector queda en la opción "todas".
    expect(screen.getByText("Todas las etiquetas")).toBeInTheDocument();
  });

  it("refleja la etiqueta filtrada", () => {
    setup({ ...PERIOD, tag_id: 5 }, true);
    expect(screen.getByText("vacaciones")).toBeInTheDocument();
  });

  it("refleja la cuenta filtrada", () => {
    setup({ ...PERIOD, account_id: 2 });
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
  });
});

describe("TransactionFilters — limpiar", () => {
  it("no ofrece limpiar cuando no hay filtros activos", () => {
    setup();
    expect(screen.queryByRole("button", { name: /Limpiar/ })).not.toBeInTheDocument();
  });

  it.each([
    ["búsqueda", { search: "café" }],
    ["tipo", { type: "expense" as const }],
    ["categoría", { category_id: 10 }],
    ["subcategoría", { subcategory_id: 11 }],
    ["sin categoría", { no_category: true }],
    ["cuenta", { account_id: 1 }],
  ])("ofrece limpiar cuando hay filtro de %s", (_label, filter) => {
    setup({ ...PERIOD, ...filter });
    expect(screen.getByRole("button", { name: /Limpiar/ })).toBeInTheDocument();
  });

  it("limpiar conserva año, mes y límite y borra el resto", async () => {
    const { onChange, user } = setup({
      year: 2026,
      month: 6,
      limit: 50,
      search: "café",
      type: "expense",
      category_id: 10,
      account_id: 1,
    });

    await user.click(screen.getByRole("button", { name: /Limpiar/ }));

    expect(onChange).toHaveBeenCalledWith({ year: 2026, month: 6, limit: 50 });
  });
});
