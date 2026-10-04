import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BalanceStatus } from "@/api/client";
import { mockFetch, normalizeCurrency, renderWithProviders } from "@/test/utils";

import { BalanceKpiCard } from "./BalanceKpiCard";

function status(overrides: Partial<BalanceStatus> = {}): BalanceStatus {
  return {
    as_of: "2026-06-15",
    available: "1250.50",
    settled: "1250.50",
    committed_expense: "0",
    accounts_initial: "1000.00",
    adjustments_total: "0",
    ...overrides,
  };
}

/** El importe grande del KPI, con los espacios duros de `Intl` normalizados. */
function shownBalance(): string {
  return normalizeCurrency(screen.getByText(/€/).textContent);
}

describe("BalanceKpiCard — importe", () => {
  it("muestra el saldo disponible en verde cuando es positivo", () => {
    render(<BalanceKpiCard status={status()} />);

    expect(shownBalance()).toBe("1250,50 €");
    expect(screen.getByText(/€/)).toHaveClass("text-income");
  });

  it("muestra un saldo negativo en rojo y con signo menos", () => {
    render(<BalanceKpiCard status={status({ available: "-80.25" })} />);

    expect(shownBalance()).toBe("-80,25 €");
    expect(screen.getByText(/€/)).toHaveClass("text-expense");
  });

  it("avisa de los gastos futuros ya descontados", () => {
    render(
      <BalanceKpiCard status={status({ available: "950.50", committed_expense: "300.00" })} />,
    );

    expect(screen.getByText(/comprometidos/)).toBeInTheDocument();
    expect(normalizeCurrency(screen.getByText(/-300,00/).textContent)).toBe("-300,00 €");
  });

  it("no habla de compromisos cuando no hay gastos futuros", () => {
    render(<BalanceKpiCard status={status()} />);

    expect(screen.queryByText(/comprometidos/)).not.toBeInTheDocument();
    expect(screen.getByText("Disponible ahora mismo")).toBeInTheDocument();
  });

  it("muestra un esqueleto mientras no hay datos", () => {
    render(<BalanceKpiCard status={undefined} />);

    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ajustar saldo")).not.toBeInTheDocument();
  });
});

describe("BalanceKpiCard — ajuste manual", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("envía el saldo indicado al guardar", async () => {
    const fetchMock = mockFetch({
      "/api/balance/adjustments": [],
      "/api/balance": status({ available: "1300.00" }),
    });
    const user = userEvent.setup();

    renderWithProviders(<BalanceKpiCard status={status()} />);

    await user.click(screen.getByLabelText("Ajustar saldo"));

    const input = await screen.findByLabelText("Saldo disponible");
    expect(input).toHaveValue("1250.50"); // prerrellenado con el saldo actual

    await user.clear(input);
    await user.type(input, "1300,00");
    await user.type(screen.getByLabelText("Nota (opcional)"), "Efectivo");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(put).toBeDefined();
      expect(JSON.parse((put![1] as RequestInit).body as string)).toEqual({
        available: "1300.00", // la coma se normaliza a punto
        note: "Efectivo",
      });
    });
  });

  it("lista los ajustes anteriores y permite borrarlos", async () => {
    const fetchMock = mockFetch({
      "/api/balance/adjustments": [
        {
          id: 7,
          date: "2026-06-15",
          amount: "25.50",
          note: "Efectivo en la cartera",
          created_at: "2026-06-15T10:00:00Z",
        },
      ],
      "/api/balance": status(),
    });
    const user = userEvent.setup();

    renderWithProviders(<BalanceKpiCard status={status()} />);
    await user.click(screen.getByLabelText("Ajustar saldo"));

    expect(await screen.findByText("Efectivo en la cartera")).toBeInTheDocument();
    expect(screen.getByText("15/06/2026")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Eliminar ajuste"));

    await waitFor(() => {
      const del = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === "DELETE",
      );
      expect(del).toBeDefined();
      expect(String(del![0])).toContain("/api/balance/adjustments/7");
    });
  });
});
