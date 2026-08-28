import type { AccountRead, CsvPreviewResult } from "@/api/client";

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { api } from "@/api/client";
import { mockFetch, renderWithProviders } from "@/test/utils";

import { CsvImportDialog } from "./CsvImportDialog";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const accounts = [{ id: 1, name: "Banco", type: "bank" }] as AccountRead[];

const preview: CsvPreviewResult = {
  encoding: "utf-8",
  separator: ";",
  headers: ["Fecha", "Concepto", "Importe", "Categoría"],
  preview_rows: [
    ["01/06/2026", "Mercadona", "-42,50", "Alimentación"],
    ["02/06/2026", "Nómina", "1500,00", "Ingresos"],
  ],
};

function csvFile(name = "movimientos.csv"): File {
  return new File(["Fecha;Concepto;Importe\n01/06/2026;Mercadona;-42,50\n"], name, {
    type: "text/csv",
  });
}

function setup() {
  const onOpenChange = vi.fn();
  renderWithProviders(<CsvImportDialog open onOpenChange={onOpenChange} />);
  return { onOpenChange, user: userEvent.setup() };
}

/**
 * El texto de los resultados se parte en varios nodos ("2 movimiento" + "s" +
 * " importado" + "s"), así que se busca por el texto completo del elemento.
 */
function byWholeText(expected: string) {
  return (_content: string, element: Element | null) =>
    element?.textContent?.replace(/\s+/g, " ").trim() === expected &&
    !Array.from(element.children).some(
      (child) => child.textContent?.replace(/\s+/g, " ").trim() === expected,
    );
}

/** Sube el fichero por el input oculto y pasa al paso de mapeo. */
async function goToMapping(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, csvFile());
  await user.click(screen.getByRole("button", { name: /Analizar CSV/ }));
  await waitFor(() => expect(screen.getByText("Mapear columnas")).toBeInTheDocument());
}

let previewSpy: MockInstance<typeof api.transactions.csvPreview>;
let importSpy: MockInstance<typeof api.transactions.csvImportMapped>;

beforeEach(() => {
  mockFetch({ "/api/accounts": accounts });
  previewSpy = vi.spyOn(api.transactions, "csvPreview").mockResolvedValue(preview);
  importSpy = vi
    .spyOn(api.transactions, "csvImportMapped")
    .mockResolvedValue({ imported: 2, skipped: 0, uncategorized: 0, errors: [] });
});

afterEach(() => {
  previewSpy.mockRestore();
  importSpy.mockRestore();
});

describe("CsvImportDialog — paso 1: subida", () => {
  it("arranca invitando a subir un CSV", () => {
    setup();
    expect(
      screen.getByText("Arrastra un archivo CSV o haz clic para seleccionarlo"),
    ).toBeInTheDocument();
  });

  it("no deja analizar sin fichero", () => {
    setup();
    expect(screen.getByRole("button", { name: /Analizar CSV/ })).toBeDisabled();
  });

  it("muestra el nombre del fichero elegido", async () => {
    const { user } = setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, csvFile("extracto-junio.csv"));

    expect(screen.getByText("extracto-junio.csv")).toBeInTheDocument();
  });

  it("avisa si el CSV no se puede leer", async () => {
    previewSpy.mockRejectedValue(new Error("boom"));
    const { user } = setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, csvFile());
    await user.click(screen.getByRole("button", { name: /Analizar CSV/ }));

    expect(
      await screen.findByText("No se pudo leer el archivo. Comprueba que es un CSV válido."),
    ).toBeInTheDocument();
  });
});

describe("CsvImportDialog — paso 2: mapeo", () => {
  it("muestra el separador detectado y la vista previa", async () => {
    const { user } = setup();
    await goToMapping(user);

    expect(screen.getByText("punto y coma (;)")).toBeInTheDocument();
    expect(screen.getByText("Mercadona")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Importe" })).toBeInTheDocument();
  });

  it("no deja importar hasta mapear las columnas obligatorias", async () => {
    const { user } = setup();
    await goToMapping(user);

    expect(screen.getByRole("button", { name: /Importar/ })).toBeDisabled();
  });

  it("permite volver al paso anterior", async () => {
    const { user } = setup();
    await goToMapping(user);

    await user.click(screen.getByRole("button", { name: /Atrás|Volver/ }));

    await waitFor(() =>
      expect(
        screen.getByText("Arrastra un archivo CSV o haz clic para seleccionarlo"),
      ).toBeInTheDocument(),
    );
  });

  it("importa con el mapeo elegido y los valores por defecto", async () => {
    const { user } = setup();
    await goToMapping(user);

    // Los tres selectores obligatorios, en el orden en que se pintan.
    const combos = screen.getAllByRole("combobox");
    for (const [index, header] of [
      [0, "Fecha"],
      [1, "Concepto"],
      [2, "Importe"],
    ] as const) {
      await user.click(combos[index]);
      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByRole("option", { name: header }));
    }

    const importButton = screen.getByRole("button", { name: /Importar/ });
    await waitFor(() => expect(importButton).toBeEnabled());
    await user.click(importButton);

    await waitFor(() => expect(importSpy).toHaveBeenCalled());
    const [, accountId, mapping] = importSpy.mock.calls[0];
    expect(accountId).toBe(1);
    expect(mapping).toMatchObject({
      date_col: "Fecha",
      concept_col: "Concepto",
      amount_col: "Importe",
      date_format: "auto",
      decimal_sep: "auto",
      sign_convention: "signed",
      description_col: null,
      category_col: null,
    });
  });
});

describe("CsvImportDialog — paso 3: resultado", () => {
  async function importAndReachResult(user: ReturnType<typeof userEvent.setup>) {
    await goToMapping(user);
    const combos = screen.getAllByRole("combobox");
    for (const [index, header] of [
      [0, "Fecha"],
      [1, "Concepto"],
      [2, "Importe"],
    ] as const) {
      await user.click(combos[index]);
      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByRole("option", { name: header }));
    }
    await user.click(screen.getByRole("button", { name: /Importar/ }));
  }

  it("resume cuántos movimientos entraron", async () => {
    const { user } = setup();
    await importAndReachResult(user);

    expect(await screen.findByText(byWholeText("2 movimientos importados"))).toBeInTheDocument();
  });

  it("usa el singular con un solo movimiento", async () => {
    importSpy.mockResolvedValue({ imported: 1, skipped: 0, uncategorized: 0, errors: [] });
    const { user } = setup();
    await importAndReachResult(user);

    expect(await screen.findByText(byWholeText("1 movimiento importado"))).toBeInTheDocument();
  });

  it("informa de las filas omitidas", async () => {
    importSpy.mockResolvedValue({ imported: 1, skipped: 3, uncategorized: 0, errors: [] });
    const { user } = setup();
    await importAndReachResult(user);

    expect(await screen.findByText(byWholeText("3 filas omitidas"))).toBeInTheDocument();
  });

  it("ofrece revisar los movimientos sin categoría", async () => {
    importSpy.mockResolvedValue({ imported: 5, skipped: 0, uncategorized: 2, errors: [] });
    const { user } = setup();
    await importAndReachResult(user);

    expect(
      await screen.findByRole("button", { name: /Ver movimientos sin categoría/ }),
    ).toBeInTheDocument();
  });

  it("lista los errores por fila", async () => {
    importSpy.mockResolvedValue({
      imported: 0,
      skipped: 2,
      uncategorized: 0,
      errors: ["Fila 2: Fecha inválida", "Fila 5: Importe inválido"],
    });
    const { user } = setup();
    await importAndReachResult(user);

    expect(await screen.findByText(/Filas con error \(2\)/)).toBeInTheDocument();
    expect(screen.getByText("Fila 2: Fecha inválida")).toBeInTheDocument();
  });

  it("cerrar avisa al padre", async () => {
    const { user, onOpenChange } = setup();
    await importAndReachResult(user);

    await user.click(await screen.findByRole("button", { name: "Cerrar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
