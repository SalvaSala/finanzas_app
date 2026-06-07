import type { TransactionType } from "@/api/client";

const CURRENCY_FMT = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const DATE_FMT = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatAmount(amount: string, type: TransactionType): string {
  const num = parseFloat(amount);
  const formatted = CURRENCY_FMT.format(num);
  if (type === "expense") return `-${formatted}`;
  return formatted;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return DATE_FMT.format(new Date(year, month - 1, day));
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
