import type { AccountRead, CategoryRead, TagRead, TransactionRead } from "@/api/client";

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockFetch, renderWithProviders } from "@/test/utils";

import { TransactionForm } from "./TransactionForm";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const accounts = [
  { id: 1, name: "Banco", type: "bank" },
  { id: 2, name: "Efectivo", type: "cash" },
] as AccountRead[];

const categories = [
  { id: 10, name: "Alimentación", type: "expense", parent_id: null },
  { id: 11, name: "Supermercado", type: "expense", parent_id: 10 },
  { id: 12, name: "Restaurantes", type: "expense", parent_id: 10 },
  { id: 15, name: "Ocio", type: "expense", parent_id: null },
  { id: 20, name: "Nómina", type: "income", parent_id: null },
] as CategoryRead[];

const tags = [{ id: 5, name: "vacaciones", color: null }] as TagRead[];

const existing: TransactionRead = {
  id: 42,
  date: "2026-06-15",
  type: "expense",
  concept: "Compra semanal",
  description: "Notas previas",
  amount: "42.50",
  account_id: 1,
  transfer_account_id: null,
  category_id: 10,
  subcategory_id: 11,
  recurring_id: null,
  tags: [],
  created_at: "2026-06-15T10:00:00",
} as TransactionRead;

function setup(props: Partial<Parameters<typeof TransactionForm>[0]> = {}) {
  const onOpenChange = vi.fn();
  const result = renderWithProviders(
    <TransactionForm
      open
      onOpenChange={onOpenChange}
      accounts={accounts}
      categories={categories}
      tags={tags}
      {...props}
    />,
  );
  return { ...result, onOpenChange, user: userEvent.setup() };
}

/** Cuerpo JSON de la llamada `n` a `fetch`. */
function bodyOf(fetchMock: ReturnType<typeof vi.fn>, n = 0): Record<string, unknown> {
  return JSON.parse((fetchMock.mock.calls[n][1] as RequestInit).body as string);
}

/** La llamada de creación/edición, ignorando la de etiquetas. */
function txCall(fetchMock: ReturnType<typeof vi.fn>): number {
  return fetchMock.mock.calls.findIndex(
    ([url]) => String(url) === "/api/transactions" || /^\/api\/transactions\/\d+$/.test(String(url)),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = mockFetch({
    "/api/transactions": { id: 99, tags: [] },
    "/api/tags": [],
  });
});

describe("TransactionForm — modos", () => {
  it("titula 'Nuevo movimiento' al crear", () => {
    setup();
    expect(screen.getByText("Nuevo movimiento")).toBeInTheDocument();
  });

  it("titula 'Editar movimiento' al editar", () => {
    setup({ transaction: existing });
    expect(screen.getByText("Editar movimiento")).toBeInTheDocument();
  });

  it("titula 'Duplicar movimiento' al duplicar", () => {
    setup({ duplicateFrom: existing });
    expect(screen.getByText("Duplicar movimiento")).toBeInTheDocument();
  });

  it("precarga los datos al editar", () => {
    setup({ transaction: existing });

    expect(screen.getByDisplayValue("Compra semanal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42.50")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-06-15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Notas previas")).toBeInTheDocument();
  });

  it("al crear ofrece 'Guardar y crear otro'; al editar no", () => {
    const { unmount } = setup();
    expect(screen.getByRole("button", { name: "Guardar y crear otro" })).toBeInTheDocument();
    unmount();

    setup({ transaction: existing });
    expect(screen.queryByRole("button", { name: "Guardar y crear otro" })).not.toBeInTheDocument();
  });

  it("el botón principal cambia de texto según el modo", () => {
    const { unmount } = setup();
    expect(screen.getByRole("button", { name: "Crear movimiento" })).toBeInTheDocument();
    unmount();

    setup({ transaction: existing });
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });
});

describe("TransactionForm — validación", () => {
  it("exige concepto e importe", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    expect(await screen.findAllByText("Obligatorio")).toHaveLength(2);
    // El autocompletado de conceptos sí consulta; lo que no debe haber es alta/edición.
    expect(txCall(fetchMock)).toBe(-1);
  });

  it("rechaza un importe no numérico", async () => {
    const { user } = setup();

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Compra");
    await user.type(screen.getByPlaceholderText("0.00"), "abc");
    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    expect(await screen.findByText(/Importe inválido/)).toBeInTheDocument();
    // El autocompletado de conceptos sí consulta; lo que no debe haber es alta/edición.
    expect(txCall(fetchMock)).toBe(-1);
  });

  it("rechaza un importe de cero", async () => {
    const { user } = setup();

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Compra");
    await user.type(screen.getByPlaceholderText("0.00"), "0");
    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    expect(await screen.findByText(/Importe inválido/)).toBeInTheDocument();
  });

  it("rechaza más de dos decimales", async () => {
    const { user } = setup();

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Compra");
    await user.type(screen.getByPlaceholderText("0.00"), "10.999");
    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    expect(await screen.findByText(/Importe inválido/)).toBeInTheDocument();
  });

  it("acepta la coma como separador decimal y la normaliza a punto", async () => {
    const { user } = setup();

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Compra");
    await user.type(screen.getByPlaceholderText("0.00"), "10,50");
    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    await waitFor(() => expect(txCall(fetchMock)).toBeGreaterThanOrEqual(0));
    expect(bodyOf(fetchMock, txCall(fetchMock)).amount).toBe("10.50");
  });
});

describe("TransactionForm — envío", () => {
  it("crea un gasto con los datos del formulario", async () => {
    const { user } = setup();

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Compra semanal");
    await user.type(screen.getByPlaceholderText("0.00"), "42.50");
    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    await waitFor(() => expect(txCall(fetchMock)).toBeGreaterThanOrEqual(0));

    const i = txCall(fetchMock);
    expect(String(fetchMock.mock.calls[i][0])).toBe("/api/transactions");
    expect((fetchMock.mock.calls[i][1] as RequestInit).method).toBe("POST");
    expect(bodyOf(fetchMock, i)).toMatchObject({
      type: "expense",
      concept: "Compra semanal",
      amount: "42.50",
      account_id: 1,
      transfer_account_id: null,
    });
  });

  it("edita con PATCH sobre el id del movimiento", async () => {
    const { user } = setup({ transaction: existing });

    await user.clear(screen.getByPlaceholderText("0.00"));
    await user.type(screen.getByPlaceholderText("0.00"), "99.99");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(txCall(fetchMock)).toBeGreaterThanOrEqual(0));

    const i = txCall(fetchMock);
    expect(String(fetchMock.mock.calls[i][0])).toBe("/api/transactions/42");
    expect((fetchMock.mock.calls[i][1] as RequestInit).method).toBe("PATCH");
    expect(bodyOf(fetchMock, i).amount).toBe("99.99");
  });

  it("convierte las notas vacías en null", async () => {
    const { user } = setup();

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Compra");
    await user.type(screen.getByPlaceholderText("0.00"), "10.00");
    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    await waitFor(() => expect(txCall(fetchMock)).toBeGreaterThanOrEqual(0));
    expect(bodyOf(fetchMock, txCall(fetchMock)).description).toBeNull();
  });

  it("cierra el diálogo tras crear", async () => {
    const { user, onOpenChange } = setup();

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Compra");
    await user.type(screen.getByPlaceholderText("0.00"), "10.00");
    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("'Guardar y crear otro' deja el diálogo abierto y vacía el concepto", async () => {
    const { user, onOpenChange } = setup();

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Compra");
    await user.type(screen.getByPlaceholderText("0.00"), "10.00");
    await user.click(screen.getByRole("button", { name: "Guardar y crear otro" }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Ej: Supermercado Mercadona")).toHaveValue(""),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("cancelar cierra sin enviar nada", async () => {
    const { user, onOpenChange } = setup();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    // El autocompletado de conceptos sí consulta; lo que no debe haber es alta/edición.
    expect(txCall(fetchMock)).toBe(-1);
  });
});

describe("TransactionForm — transferencias", () => {
  it("pide cuenta destino distinta al origen", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox", { name: /Tipo/ }));
    await user.click(await screen.findByRole("option", { name: "Transferencia" }));

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Traspaso");
    await user.type(screen.getByPlaceholderText("0.00"), "50.00");
    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    expect(
      await screen.findByText("Elige una cuenta destino distinta a la de origen"),
    ).toBeInTheDocument();
    // El autocompletado de conceptos sí consulta; lo que no debe haber es alta/edición.
    expect(txCall(fetchMock)).toBe(-1);
  });

  it("al pasar a transferencia renombra la cuenta a 'Cuenta origen'", async () => {
    const { user } = setup();

    expect(screen.getByText("Cuenta")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /Tipo/ }));
    await user.click(await screen.findByRole("option", { name: "Transferencia" }));

    expect(await screen.findByText("Cuenta origen")).toBeInTheDocument();
    expect(screen.getByText("Cuenta destino")).toBeInTheDocument();
  });

  it("las transferencias no llevan categoría", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox", { name: /Tipo/ }));
    await user.click(await screen.findByRole("option", { name: "Transferencia" }));

    await waitFor(() => expect(screen.queryByText("Categoría")).not.toBeInTheDocument());
  });
});

describe("TransactionForm — categorías", () => {
  it("solo ofrece categorías del tipo seleccionado", async () => {
    const { user } = setup();

    // Por defecto el tipo es gasto: no debe aparecer la categoría de ingreso.
    await user.click(screen.getByRole("combobox", { name: /Categoría/ }));

    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "Alimentación" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "Nómina" })).not.toBeInTheDocument();
  });

  it("muestra la categoría y subcategoría precargadas al editar", () => {
    // Regresión: los `useEffect` que limpiaban los campos dependientes al
    // cambiar tipo/categoría también saltaban al precargar el movimiento, así
    // que el diálogo se abría mostrando "Sin categoría" y al guardar la borraba.
    setup({ transaction: existing });

    const combos = screen.getAllByRole("combobox").map((c) => c.textContent);
    expect(combos).toContain("Alimentación");
    expect(combos).toContain("Supermercado");
  });

  it("cambiar de categoría limpia la subcategoría anterior", async () => {
    const { user } = setup({ transaction: existing });

    await user.click(screen.getByRole("combobox", { name: /Categoría/ }));
    await user.click(await screen.findByRole("option", { name: "Ocio" }));

    await waitFor(() =>
      expect(screen.getAllByRole("combobox").map((c) => c.textContent)).toContain(
        "Sin subcategoría",
      ),
    );
  });

  it("cambiar de tipo limpia la categoría anterior", async () => {
    const { user } = setup({ transaction: existing });

    await user.click(screen.getByRole("combobox", { name: /Tipo/ }));
    await user.click(await screen.findByRole("option", { name: "Ingreso" }));

    await waitFor(() =>
      expect(screen.getAllByRole("combobox").map((c) => c.textContent)).toContain("Sin categoría"),
    );
  });

  it("envía la categoría y la subcategoría elegidas", async () => {
    const { user } = setup({ transaction: existing });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(txCall(fetchMock)).toBeGreaterThanOrEqual(0));
    expect(bodyOf(fetchMock, txCall(fetchMock))).toMatchObject({
      category_id: 10,
      subcategory_id: 11,
    });
  });

  it("envía null cuando no se elige categoría", async () => {
    const { user } = setup();

    await user.type(screen.getByPlaceholderText("Ej: Supermercado Mercadona"), "Compra");
    await user.type(screen.getByPlaceholderText("0.00"), "10.00");
    await user.click(screen.getByRole("button", { name: "Crear movimiento" }));

    await waitFor(() => expect(txCall(fetchMock)).toBeGreaterThanOrEqual(0));
    expect(bodyOf(fetchMock, txCall(fetchMock))).toMatchObject({
      category_id: null,
      subcategory_id: null,
    });
  });
});

describe("TransactionForm — convertir en recurrente", () => {
  it("solo aparece al editar", () => {
    const onConvertToRecurring = vi.fn();
    const { unmount } = setup({ onConvertToRecurring });
    expect(
      screen.queryByRole("button", { name: /Convertir en recurrente/ }),
    ).not.toBeInTheDocument();
    unmount();

    setup({ transaction: existing, onConvertToRecurring });
    expect(screen.getByRole("button", { name: /Convertir en recurrente/ })).toBeInTheDocument();
  });

  it("cierra el diálogo y avisa al padre con el movimiento", async () => {
    const onConvertToRecurring = vi.fn();
    const { user, onOpenChange } = setup({ transaction: existing, onConvertToRecurring });

    await user.click(screen.getByRole("button", { name: /Convertir en recurrente/ }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConvertToRecurring).toHaveBeenCalledWith(existing);
  });
});
