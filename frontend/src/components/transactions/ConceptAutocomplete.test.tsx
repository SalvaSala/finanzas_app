import type { ConceptSuggestion } from "@/api/client";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { api } from "@/api/client";

import { ConceptAutocomplete } from "./ConceptAutocomplete";

const SUGGESTIONS: ConceptSuggestion[] = [
  { concept: "Mercadona", category_id: 10, subcategory_id: 11 },
  { concept: "Mercado central", category_id: 10, subcategory_id: null },
];

/**
 * Envoltorio con estado: el componente recibe un `field` de react-hook-form,
 * así que aquí se simula lo justo (value / onChange / onBlur / name / ref).
 */
function Harness({ onSuggestionSelect }: { onSuggestionSelect: (s: ConceptSuggestion) => void }) {
  const [value, setValue] = useState("");
  const field = {
    value,
    onChange: (v: unknown) =>
      setValue(typeof v === "string" ? v : (v as React.ChangeEvent<HTMLInputElement>).target.value),
    onBlur: () => {},
    name: "concept" as const,
    ref: () => {},
  };
  return (
    <ConceptAutocomplete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field={field as any}
      onSuggestionSelect={onSuggestionSelect}
      placeholder="Concepto"
    />
  );
}

function setup() {
  const onSuggestionSelect = vi.fn();
  render(<Harness onSuggestionSelect={onSuggestionSelect} />);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  return { onSuggestionSelect, user, input: screen.getByPlaceholderText("Concepto") };
}

let suggestSpy: MockInstance<typeof api.transactions.suggestConcepts>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  suggestSpy = vi.spyOn(api.transactions, "suggestConcepts").mockResolvedValue(SUGGESTIONS);
});

afterEach(() => {
  vi.useRealTimers();
  suggestSpy.mockRestore();
});

describe("ConceptAutocomplete — cuándo consulta", () => {
  it("no consulta con menos de 2 caracteres", async () => {
    const { user, input } = setup();

    await user.type(input, "M");
    await vi.advanceTimersByTimeAsync(500);

    expect(suggestSpy).not.toHaveBeenCalled();
  });

  it("consulta a partir de 2 caracteres", async () => {
    const { user, input } = setup();

    await user.type(input, "Me");
    await vi.advanceTimersByTimeAsync(500);

    expect(suggestSpy).toHaveBeenCalledWith("Me");
  });

  it("hace debounce: al teclear rápido solo consulta una vez", async () => {
    const { user, input } = setup();

    await user.type(input, "Merca");
    await vi.advanceTimersByTimeAsync(500);

    expect(suggestSpy).toHaveBeenCalledTimes(1);
    expect(suggestSpy).toHaveBeenCalledWith("Merca");
  });

  it("no consulta antes de que venza el debounce", async () => {
    const { user, input } = setup();

    await user.type(input, "Me");
    await vi.advanceTimersByTimeAsync(200);

    expect(suggestSpy).not.toHaveBeenCalled();
  });
});

describe("ConceptAutocomplete — lista de sugerencias", () => {
  it("muestra las sugerencias devueltas", async () => {
    const { user, input } = setup();

    await user.type(input, "Merca");
    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => expect(screen.getByText("Mercadona")).toBeInTheDocument());
    expect(screen.getByText("Mercado central")).toBeInTheDocument();
  });

  it("no abre la lista si no hay resultados", async () => {
    suggestSpy.mockResolvedValue([]);
    const { user, input } = setup();

    await user.type(input, "zzz");
    await vi.advanceTimersByTimeAsync(500);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("cierra la lista si la petición falla", async () => {
    suggestSpy.mockRejectedValue(new Error("boom"));
    const { user, input } = setup();

    await user.type(input, "Merca");
    await vi.advanceTimersByTimeAsync(500);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("cierra la lista al borrar por debajo del mínimo", async () => {
    const { user, input } = setup();

    await user.type(input, "Merca");
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(screen.getByText("Mercadona")).toBeInTheDocument());

    await user.clear(input);
    await user.type(input, "M");

    await waitFor(() => expect(screen.queryByText("Mercadona")).not.toBeInTheDocument());
  });
});

describe("ConceptAutocomplete — selección", () => {
  it("al hacer clic rellena el campo y avisa al formulario", async () => {
    const { onSuggestionSelect, user, input } = setup();

    await user.type(input, "Merca");
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(screen.getByText("Mercadona")).toBeInTheDocument());

    await user.click(screen.getByText("Mercadona"));

    expect(onSuggestionSelect).toHaveBeenCalledWith(SUGGESTIONS[0]);
    expect(input).toHaveValue("Mercadona");
  });

  it("se navega con las flechas y se elige con Enter", async () => {
    const { onSuggestionSelect, user, input } = setup();

    await user.type(input, "Merca");
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(screen.getByText("Mercadona")).toBeInTheDocument());

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onSuggestionSelect).toHaveBeenCalledWith(SUGGESTIONS[1]);
  });

  it("Enter sin nada resaltado no selecciona", async () => {
    const { onSuggestionSelect, user, input } = setup();

    await user.type(input, "Merca");
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(screen.getByText("Mercadona")).toBeInTheDocument());

    await user.keyboard("{Enter}");

    expect(onSuggestionSelect).not.toHaveBeenCalled();
  });

  it("Escape cierra la lista", async () => {
    const { user, input } = setup();

    await user.type(input, "Merca");
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(screen.getByText("Mercadona")).toBeInTheDocument());

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Mercadona")).not.toBeInTheDocument();
  });
});
