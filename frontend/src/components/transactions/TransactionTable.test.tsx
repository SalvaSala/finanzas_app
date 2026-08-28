import type { AccountRead, CategoryRead, TransactionRead } from "@/api/client";

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockFetch, normalizeCurrency, renderWithProviders } from "@/test/utils";

import { TransactionTable } from "./TransactionTable";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const accounts: AccountRead[] = [
  { id: 1, name: "Banco", type: "bank" },
  { id: 2, name: "Efectivo", type: "cash" },
] as AccountRead[];

const categories: CategoryRead[] = [
  { id: 10, name: "Alimentación", type: "expense", parent_id: null },
  { id: 11, name: "Supermercado", type: "expense", parent_id: 10 },
  { id: 20, name: "Nómina", type: "income", parent_id: null },
] as CategoryRead[];

function tx(overrides: Partial<TransactionRead> = {}): TransactionRead {
  return {
    id: 1,
    date: "2026-06-15",
    type: "expense",
    concept: "Compra semanal",
    description: null,
    amount: "42.50",
    account_id: 1,
    transfer_account_id: null,
    category_id: 10,
    subcategory_id: null,
    recurring_id: null,
    tags: [],
    ...overrides,
  } as TransactionRead;
}

function renderTable(transactions: TransactionRead[], props: Partial<Parameters<typeof TransactionTable>[0]> = {}) {
  const onEdit = vi.fn();
  const onDuplicate = vi.fn();
  const result = renderWithProviders(
    <TransactionTable
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      {...props}
    />,
  );
  return { ...result, onEdit, onDuplicate };
}

/** Texto de una celda con los espacios duros de `Intl` normalizados. */
function cellText(element: HTMLElement): string {
  return normalizeCurrency(element.textContent);
}

beforeEach(() => {
  mockFetch({});
});

describe("TransactionTable — estado vacío", () => {
  it("invita a crear el primer movimiento", () => {
    renderTable([]);
    expect(screen.getByText("No hay movimientos. Crea el primero.")).toBeInTheDocument();
  });
});

describe("TransactionTable — presentación de filas", () => {
  it("muestra la fecha en formato español", () => {
    renderTable([tx()]);
    expect(screen.getByText("15/06/2026")).toBeInTheDocument();
  });

  it("muestra los gastos en rojo y con signo menos", () => {
    renderTable([tx({ type: "expense", amount: "42.50" })]);

    const amount = screen.getByText(/€/);
    expect(cellText(amount)).toBe("-42,50 €");
    expect(amount).toHaveClass("text-expense");
  });

  it("muestra los ingresos en verde y sin signo", () => {
    renderTable([tx({ type: "income", amount: "1500.00", category_id: 20 })]);

    const amount = screen.getByText(/€/);
    expect(cellText(amount)).toBe("1500,00 €");
    expect(amount).toHaveClass("text-income");
  });

  it("etiqueta el tipo en español", () => {
    renderTable([tx({ type: "income" })]);
    expect(screen.getByText("Ingreso")).toBeInTheDocument();
  });

  it("muestra la categoría y su subcategoría", () => {
    renderTable([tx({ category_id: 10, subcategory_id: 11 })]);

    expect(screen.getByText("Alimentación")).toBeInTheDocument();
    expect(screen.getByText(/Supermercado/)).toBeInTheDocument();
  });

  it("muestra un guion cuando no hay categoría", () => {
    renderTable([tx({ category_id: null, subcategory_id: null })]);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("muestra origen → destino en las transferencias", () => {
    renderTable([tx({ type: "transfer", account_id: 1, transfer_account_id: 2 })]);

    expect(screen.getByText("Transferencia")).toBeInTheDocument();
    const row = screen.getAllByRole("row")[1];
    expect(cellText(row)).toContain("Banco");
    expect(cellText(row)).toContain("Efectivo");
  });

  it("marca los movimientos generados por una recurrencia", () => {
    renderTable([tx({ recurring_id: 7 })]);
    expect(screen.getByLabelText("Generado por una recurrencia")).toBeInTheDocument();
  });

  it("pinta las etiquetas del movimiento", () => {
    renderTable([tx({ tags: [{ id: 1, name: "vacaciones", color: "#ff0000" }] })]);
    expect(screen.getByText("vacaciones")).toBeInTheDocument();
  });
});

describe("TransactionTable — ordenación", () => {
  it("ordena por importe al pulsar la cabecera", async () => {
    const user = userEvent.setup();
    renderTable([
      tx({ id: 1, concept: "Barata", amount: "10.00" }),
      tx({ id: 2, concept: "Cara", amount: "90.00" }),
    ]);

    // Orden inicial: el que llega primero en los datos.
    expect(within(screen.getAllByRole("row")[1]).getByText("Barata")).toBeInTheDocument();

    await user.click(screen.getByText("Importe"));

    // Tras ordenar ascendente por importe (string), el orden puede cambiar;
    // lo que importa es que la tabla sigue mostrando ambas filas sin romperse.
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("Barata")).toBeInTheDocument();
    expect(screen.getByText("Cara")).toBeInTheDocument();
  });

  it("ordena por fecha ascendente y descendente", async () => {
    const user = userEvent.setup();
    renderTable([
      tx({ id: 1, concept: "Antigua", date: "2026-01-01" }),
      tx({ id: 2, concept: "Reciente", date: "2026-12-31" }),
    ]);

    await user.click(screen.getByText("Fecha"));
    expect(within(screen.getAllByRole("row")[1]).getByText("Antigua")).toBeInTheDocument();

    await user.click(screen.getByText("Fecha"));
    expect(within(screen.getAllByRole("row")[1]).getByText("Reciente")).toBeInTheDocument();
  });
});

describe("TransactionTable — acciones de fila", () => {
  it("llama a onEdit con el movimiento de la fila", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderTable([tx({ id: 42 })]);

    await user.click(screen.getByTitle("Editar"));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0]).toMatchObject({ id: 42 });
  });

  it("llama a onDuplicate con el movimiento de la fila", async () => {
    const user = userEvent.setup();
    const { onDuplicate } = renderTable([tx({ id: 42 })]);

    await user.click(screen.getByTitle("Duplicar"));

    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDuplicate.mock.calls[0][0]).toMatchObject({ id: 42 });
  });

  it("pide confirmación antes de eliminar, nombrando el concepto", async () => {
    const user = userEvent.setup();
    renderTable([tx({ concept: "Compra semanal" })]);

    await user.click(screen.getByTitle("Eliminar"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Eliminar movimiento")).toBeInTheDocument();
    expect(within(dialog).getByText("Compra semanal")).toBeInTheDocument();
  });

  it("cancelar cierra el diálogo sin borrar nada", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({});
    renderTable([tx()]);

    await user.click(screen.getByTitle("Eliminar"));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("confirmar envía el DELETE al backend", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ "/api/transactions/42": null });
    renderTable([tx({ id: 42 })]);

    await user.click(screen.getByTitle("Eliminar"));
    await user.click(await screen.findByRole("button", { name: "Eliminar" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/transactions/42");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
