import { describe, expect, it } from "vitest";

import { normalizeCurrency } from "@/test/utils";

import { formatAmount, formatDate, todayIso } from "./format";

describe("formatAmount", () => {
  it("formatea ingresos en euros con locale es-ES", () => {
    expect(normalizeCurrency(formatAmount("1234.56", "income"))).toBe("1234,56 €");
  });

  it("antepone el signo menos a los gastos", () => {
    expect(normalizeCurrency(formatAmount("1234.56", "expense"))).toBe("-1234,56 €");
  });

  it("no antepone signo a las transferencias", () => {
    expect(normalizeCurrency(formatAmount("50.00", "transfer"))).toBe("50,00 €");
  });

  it("mantiene siempre dos decimales", () => {
    expect(normalizeCurrency(formatAmount("5", "income"))).toBe("5,00 €");
    expect(normalizeCurrency(formatAmount("5.5", "income"))).toBe("5,50 €");
  });

  it("formatea el cero sin signo", () => {
    expect(normalizeCurrency(formatAmount("0", "income"))).toBe("0,00 €");
  });

  it("usa el punto como separador de miles", () => {
    expect(normalizeCurrency(formatAmount("1000000", "income"))).toBe("1.000.000,00 €");
  });
});

describe("formatDate", () => {
  it("convierte ISO a formato español dd/mm/aaaa", () => {
    expect(formatDate("2026-06-15")).toBe("15/06/2026");
  });

  it("rellena con ceros los días y meses de un dígito", () => {
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
  });

  it("no desplaza el día por la zona horaria", () => {
    // Construir la fecha con `new Date("2026-01-01")` la interpretaría como UTC
    // y en husos negativos mostraría el 31/12. Aquí debe seguir siendo el día 1.
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });
});

describe("todayIso", () => {
  it("devuelve la fecha de hoy en formato ISO corto", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
