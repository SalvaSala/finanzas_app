import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { normalizeCurrency } from "@/test/utils";

import { KpiCard } from "./KpiCard";

/** El importe mostrado, con los espacios duros de `Intl` normalizados. */
function shownAmount(): string {
  return normalizeCurrency(screen.getByText(/€/).textContent);
}

describe("KpiCard — importe y color", () => {
  it("muestra los ingresos en verde y sin signo", () => {
    render(<KpiCard title="Ingresos" amount="1500.00" variant="income" />);

    expect(shownAmount()).toBe("1500,00 €");
    expect(screen.getByText(/€/)).toHaveClass("text-income");
  });

  it("muestra los gastos en rojo y con signo menos", () => {
    render(<KpiCard title="Gastos" amount="220.75" variant="expense" />);

    expect(shownAmount()).toBe("-220,75 €");
    expect(screen.getByText(/€/)).toHaveClass("text-expense");
  });

  it("pinta de verde un balance positivo", () => {
    render(<KpiCard title="Balance" amount="1279.25" variant="balance" />);

    expect(shownAmount()).toBe("1279,25 €");
    expect(screen.getByText(/€/)).toHaveClass("text-income");
  });

  it("pinta de rojo un balance negativo y le pone el menos", () => {
    render(<KpiCard title="Balance" amount="-340.10" variant="balance" />);

    expect(shownAmount()).toBe("-340,10 €");
    expect(screen.getByText(/€/)).toHaveClass("text-expense");
  });

  it("trata el balance cero como positivo", () => {
    render(<KpiCard title="Balance" amount="0" variant="balance" />);

    expect(shownAmount()).toBe("0,00 €");
    expect(screen.getByText(/€/)).toHaveClass("text-income");
  });

  it("muestra el título recibido", () => {
    render(<KpiCard title="Ingresos del mes" amount="10" variant="income" />);
    expect(screen.getByText("Ingresos del mes")).toBeInTheDocument();
  });
});

describe("KpiCard — variación respecto al periodo anterior", () => {
  it("no muestra nada cuando no hay variación", () => {
    render(<KpiCard title="Ingresos" amount="1500.00" variant="income" />);
    expect(screen.queryByText(/vs periodo anterior/)).not.toBeInTheDocument();
  });

  it("no muestra nada cuando la variación es null", () => {
    render(<KpiCard title="Ingresos" amount="1500.00" variant="income" change={null} />);
    expect(screen.queryByText(/vs periodo anterior/)).not.toBeInTheDocument();
  });

  it("antepone un + a las subidas", () => {
    render(<KpiCard title="Ingresos" amount="1500.00" variant="income" change={12.34} />);
    expect(screen.getByText(/\+12\.3% vs periodo anterior/)).toBeInTheDocument();
  });

  it("muestra las bajadas con su signo negativo", () => {
    render(<KpiCard title="Ingresos" amount="1500.00" variant="income" change={-8.5} />);
    expect(screen.getByText(/-8\.5% vs periodo anterior/)).toBeInTheDocument();
  });

  it("para ingresos, subir es bueno (verde)", () => {
    const { container } = render(
      <KpiCard title="Ingresos" amount="1500.00" variant="income" change={10} />,
    );
    expect(container.querySelector(".text-income.text-sm")).not.toBeNull();
  });

  it("para gastos, subir es malo (rojo)", () => {
    const { container } = render(
      <KpiCard title="Gastos" amount="500.00" variant="expense" change={10} />,
    );
    expect(container.querySelector(".text-expense.text-sm")).not.toBeNull();
  });

  it("para gastos, bajar es bueno (verde)", () => {
    const { container } = render(
      <KpiCard title="Gastos" amount="500.00" variant="expense" change={-10} />,
    );
    expect(container.querySelector(".text-income.text-sm")).not.toBeNull();
  });
});
