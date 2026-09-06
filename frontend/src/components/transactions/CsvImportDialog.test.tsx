import type { AccountRead, CsvImportPreview, CsvPreviewResult } from "@/api/client";

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
  has_header: true,
  is_native: false,
};

/** Extracto tipo Banco Sabadell: barras verticales, sin cabecera, con saldo. */
const previewSinCabecera: CsvPreviewResult = {
  encoding: "utf-8",
  separator: "|",
  headers: ["Columna 1", "Columna 2", "Columna 3", "Columna 4", "Columna 5"],
  preview_rows: [["07/09/2026", "Bizum Ana", "06/09/2026", "-33.00", "1846.26"]],
  has_header: false,
  is_native: false,
  suggested: {
    date_col: "Columna 1",
    concept_col: "Columna 2",
    amount_col: "Columna 4",
  },
};

/** Simulacro por defecto: dos filas limpias, ningún duplicado. */
const plan: CsvImportPreview = {
  total: 2,
  ready: 2,
  duplicates: 0,
  errors: 0,
  rows: [
    {
      line: 2,
      date: "2026-06-01",
      type: "expense",
      concept: "Mercadona",
      amount: "42.50",
      category: "Alimentación › Supermercado",
      duplicate: false,
      error: null,
    },
    {
      line: 3,
      date: "2026-06-02",
      type: "income",
      concept: "Nómina",
      amount: "1500.00",
      category: null,
      duplicate: false,
      error: null,
    },
  ],
};

function csvFile(name = "movimientos.csv"): File {
  return new File(["Fecha;Concepto;Importe\n01/06/2026;Mercadona;-42,50\n"], name, {
    type: "text/csv",
  });
}

/** Sube el fichero y pulsa analizar, sin esperar a un paso concreto. */
async function upload(user: ReturnType<typeof userEvent.setup>, name?: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, csvFile(name));
  await user.click(screen.getByRole("button", { name: /Analizar CSV/ }));
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

/** Mapea las tres columnas obligatorias y pasa al paso de revisión. */
async function goToReview(user: ReturnType<typeof userEvent.setup>) {
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
  await user.click(screen.getByRole("button", { name: /Revisar/ }));
  await waitFor(() => expect(screen.getByText(/fila.? en el archivo/)).toBeInTheDocument());
}

let previewSpy: MockInstance<typeof api.transactions.csvPreview>;
let importSpy: MockInstance<typeof api.transactions.csvImportMapped>;
let nativeImportSpy: MockInstance<typeof api.transactions.importCsv>;
let planSpy: MockInstance<typeof api.transactions.csvImportPreview>;

beforeEach(() => {
  mockFetch({ "/api/accounts": accounts });
  previewSpy = vi.spyOn(api.transactions, "csvPreview").mockResolvedValue(preview);
  importSpy = vi
    .spyOn(api.transactions, "csvImportMapped")
    .mockResolvedValue({ imported: 2, skipped: 0, uncategorized: 0, duplicates: 0, errors: [] });
  nativeImportSpy = vi
    .spyOn(api.transactions, "importCsv")
    .mockResolvedValue({ imported: 3, skipped: 0, errors: [] });
  planSpy = vi.spyOn(api.transactions, "csvImportPreview").mockResolvedValue(plan);
});

afterEach(() => {
  previewSpy.mockRestore();
  importSpy.mockRestore();
  nativeImportSpy.mockRestore();
  planSpy.mockRestore();
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
      await screen.findByText("No se pudo leer el archivo. Comprueba que es un CSV o TXT válido."),
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

  it("no deja avanzar hasta mapear las columnas obligatorias", async () => {
    const { user } = setup();
    await goToMapping(user);

    expect(screen.getByRole("button", { name: /Revisar/ })).toBeDisabled();
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

  it("pide el simulacro con el mapeo elegido, sin escribir nada", async () => {
    const { user } = setup();
    await goToReview(user);

    expect(importSpy).not.toHaveBeenCalled();
    const [, accountId, mapping] = planSpy.mock.calls[0];
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

describe("CsvImportDialog — paso 3: revisión", () => {
  it("resume el simulacro y pinta las filas ya parseadas", async () => {
    const { user } = setup();
    await goToReview(user);

    expect(screen.getByText(byWholeText("2 filas en el archivo"))).toBeInTheDocument();
    expect(screen.getByText(byWholeText("2 nuevos"))).toBeInTheDocument();
    expect(screen.getByText("01/06/2026")).toBeInTheDocument();
    expect(screen.getByText("Alimentación › Supermercado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar 2 movimientos" })).toBeEnabled();
  });

  it("avisa de los que ya están guardados y los omite por defecto", async () => {
    planSpy.mockResolvedValue({
      ...plan,
      ready: 1,
      duplicates: 1,
      rows: [plan.rows[0], { ...plan.rows[1], duplicate: true }],
    });
    const { user } = setup();
    await goToReview(user);

    expect(screen.getByText(byWholeText("1 ya guardado"))).toBeInTheDocument();
    const omitir = screen.getByRole("checkbox");
    expect(omitir).toBeChecked();
    expect(screen.getByRole("button", { name: "Importar 1 movimiento" })).toBeInTheDocument();

    await user.click(omitir);

    expect(screen.getByRole("button", { name: "Importar 2 movimientos" })).toBeInTheDocument();
  });

  it("envía la decisión sobre los duplicados al importar", async () => {
    planSpy.mockResolvedValue({ ...plan, ready: 1, duplicates: 1 });
    const { user } = setup();
    await goToReview(user);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Importar/ }));

    await waitFor(() => expect(importSpy).toHaveBeenCalled());
    expect(importSpy.mock.calls[0][2]).toMatchObject({ skip_duplicates: false });
  });

  it("muestra el motivo de las filas que fallarán", async () => {
    planSpy.mockResolvedValue({
      total: 1,
      ready: 0,
      duplicates: 0,
      errors: 1,
      rows: [
        {
          line: 4,
          date: null,
          type: null,
          concept: "",
          amount: null,
          category: null,
          duplicate: false,
          error: "Fecha inválida: 'ayer'.",
        },
      ],
    });
    const { user } = setup();
    await goToReview(user);

    expect(screen.getByText("Fecha inválida: 'ayer'.")).toBeInTheDocument();
    expect(screen.getByText(byWholeText("1 con error"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar 0/ })).toBeDisabled();
  });

  it("permite volver al mapeo", async () => {
    const { user } = setup();
    await goToReview(user);

    await user.click(screen.getByRole("button", { name: /Volver/ }));

    await waitFor(() => expect(screen.getByText("Mapear columnas")).toBeInTheDocument());
  });
});

describe("CsvImportDialog — paso 4: resultado", () => {
  async function importAndReachResult(user: ReturnType<typeof userEvent.setup>) {
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: /Importar/ }));
  }

  it("resume cuántos movimientos entraron", async () => {
    const { user } = setup();
    await importAndReachResult(user);

    expect(await screen.findByText(byWholeText("2 movimientos importados"))).toBeInTheDocument();
  });

  it("usa el singular con un solo movimiento", async () => {
    importSpy.mockResolvedValue({ imported: 1, skipped: 0, uncategorized: 0, duplicates: 0, errors: [] });
    const { user } = setup();
    await importAndReachResult(user);

    expect(await screen.findByText(byWholeText("1 movimiento importado"))).toBeInTheDocument();
  });

  it("informa de las filas omitidas por error", async () => {
    importSpy.mockResolvedValue({ imported: 1, skipped: 3, uncategorized: 0, duplicates: 0, errors: [] });
    const { user } = setup();
    await importAndReachResult(user);

    expect(
      await screen.findByText(byWholeText("3 filas omitidas por error")),
    ).toBeInTheDocument();
  });

  it("informa de los que ya estaban guardados", async () => {
    importSpy.mockResolvedValue({ imported: 1, skipped: 0, uncategorized: 0, duplicates: 4, errors: [] });
    const { user } = setup();
    await importAndReachResult(user);

    expect(await screen.findByText(byWholeText("4 ya estaban en la app"))).toBeInTheDocument();
  });

  it("ofrece revisar los movimientos sin categoría", async () => {
    importSpy.mockResolvedValue({ imported: 5, skipped: 0, uncategorized: 2, duplicates: 0, errors: [] });
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
      duplicates: 0,
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

describe("CsvImportDialog — detección automática", () => {
  it("acepta ficheros .txt del banco", async () => {
    const { user } = setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, csvFile("06092026_2710.txt"));

    expect(screen.getByText("06092026_2710.txt")).toBeInTheDocument();
  });

  it("nombra las columnas cuando el fichero no trae cabecera", async () => {
    previewSpy.mockResolvedValue(previewSinCabecera);
    const { user } = setup();

    await upload(user);

    expect(await screen.findByRole("columnheader", { name: "Columna 1" })).toBeInTheDocument();
    expect(screen.getByText("barra vertical (|)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("relee el fichero si se corrige la detección de cabecera", async () => {
    previewSpy.mockResolvedValue(previewSinCabecera);
    const { user } = setup();
    await upload(user);
    await screen.findByText("Mapear columnas");

    await user.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(previewSpy).toHaveBeenCalledTimes(2));
    expect(previewSpy.mock.calls[1][1]).toBe(true);
  });

  it("aplica las columnas sugeridas para poder avanzar sin tocar nada", async () => {
    previewSpy.mockResolvedValue(previewSinCabecera);
    const { user } = setup();
    await upload(user);
    await screen.findByText("Mapear columnas");

    const reviewButton = screen.getByRole("button", { name: /Revisar/ });
    await waitFor(() => expect(reviewButton).toBeEnabled());
    await user.click(reviewButton);

    await waitFor(() => expect(planSpy).toHaveBeenCalled());
    const [, , mapping] = planSpy.mock.calls[0];
    expect(mapping).toMatchObject({
      date_col: "Columna 1",
      concept_col: "Columna 2",
      amount_col: "Columna 4", // la 5 es el saldo y no debe colarse
      type_col: null,
      has_header: false,
    });
  });

  it("importa el CSV propio de la app sin pedir mapeo", async () => {
    previewSpy.mockResolvedValue({ ...preview, is_native: true });
    const { user } = setup();

    await upload(user);

    expect(await screen.findByText("Es un CSV exportado por FinApp")).toBeInTheDocument();
    expect(screen.queryByText("Mapear columnas")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Importar/ }));

    await waitFor(() => expect(nativeImportSpy).toHaveBeenCalled());
    expect(importSpy).not.toHaveBeenCalled();
    expect(await screen.findByText(byWholeText("3 movimientos importados"))).toBeInTheDocument();
  });
});
