import type { components, paths } from "./schema.d.ts";

export type AccountRead = components["schemas"]["AccountRead"];
export type CategoryRead = components["schemas"]["CategoryRead"];
export type TransactionRead = components["schemas"]["TransactionRead"];
export type TransactionCreate = components["schemas"]["TransactionCreate"];
export type TransactionUpdate = components["schemas"]["TransactionUpdate"];
export type DashboardSummary = components["schemas"]["DashboardSummary"];
export type CategoryAmount = components["schemas"]["CategoryAmount"];
export type TransactionType = components["schemas"]["TransactionType"];
export type CategoryType = components["schemas"]["CategoryType"];
export type BudgetRead = components["schemas"]["BudgetRead"];
export type BudgetCreate = components["schemas"]["BudgetCreate"];
export type BudgetUpdate = components["schemas"]["BudgetUpdate"];
export type BudgetProgress = components["schemas"]["BudgetProgress"];
export type BudgetPeriod = components["schemas"]["BudgetPeriod"];
export type MonthlyStats = components["schemas"]["MonthlyStats"];

export type ListTransactionsQuery = NonNullable<
  paths["/api/transactions"]["get"]["parameters"]["query"]
>;
export type ImportResult = components["schemas"]["ImportResult"];

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => apiFetch<{ status: string }>("/api/health"),

  accounts: {
    list: () => apiFetch<AccountRead[]>("/api/accounts"),
  },

  categories: {
    list: () => apiFetch<CategoryRead[]>("/api/categories"),
  },

  transactions: {
    list: (params?: ListTransactionsQuery) => {
      const qs = new URLSearchParams();
      if (params?.year != null) qs.set("year", String(params.year));
      if (params?.month != null) qs.set("month", String(params.month));
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.type != null) qs.set("type", params.type);
      if (params?.category_id != null) qs.set("category_id", String(params.category_id));
      if (params?.account_id != null) qs.set("account_id", String(params.account_id));
      if (params?.search != null && params.search !== "")
        qs.set("search", params.search);
      const query = qs.toString();
      return apiFetch<TransactionRead[]>(
        `/api/transactions${query ? `?${query}` : ""}`,
      );
    },
    get: (id: number) => apiFetch<TransactionRead>(`/api/transactions/${id}`),
    create: (data: TransactionCreate) =>
      apiFetch<TransactionRead>("/api/transactions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: TransactionUpdate) =>
      apiFetch<TransactionRead>(`/api/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      apiFetch<void>(`/api/transactions/${id}`, { method: "DELETE" }),

    exportCsv: (params?: Omit<ListTransactionsQuery, "limit">) => {
      const qs = new URLSearchParams();
      if (params?.year != null) qs.set("year", String(params.year));
      if (params?.month != null) qs.set("month", String(params.month));
      if (params?.type != null) qs.set("type", params.type);
      if (params?.category_id != null) qs.set("category_id", String(params.category_id));
      if (params?.account_id != null) qs.set("account_id", String(params.account_id));
      if (params?.search) qs.set("search", params.search);
      const query = qs.toString();
      return fetch(`/api/transactions/export${query ? `?${query}` : ""}`);
    },

    importCsv: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return apiFetch<ImportResult>("/api/transactions/import-csv", {
        method: "POST",
        headers: {},
        body,
      });
    },
  },

  dashboard: {
    summary: (year: number, month?: number) => {
      const qs = new URLSearchParams({ year: String(year) });
      if (month != null) qs.set("month", String(month));
      return apiFetch<DashboardSummary>(`/api/dashboard/summary?${qs}`);
    },
    monthly: (year: number) =>
      apiFetch<MonthlyStats[]>(`/api/dashboard/monthly?year=${year}`),
  },

  budgets: {
    list: () => apiFetch<BudgetRead[]>("/api/budgets"),
    get: (id: number) => apiFetch<BudgetRead>(`/api/budgets/${id}`),
    progress: (year: number, month?: number) => {
      const qs = new URLSearchParams({ year: String(year) });
      if (month != null) qs.set("month", String(month));
      return apiFetch<BudgetProgress[]>(`/api/budgets/progress?${qs}`);
    },
    create: (data: BudgetCreate) =>
      apiFetch<BudgetRead>("/api/budgets", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: BudgetUpdate) =>
      apiFetch<BudgetRead>(`/api/budgets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      apiFetch<void>(`/api/budgets/${id}`, { method: "DELETE" }),
  },
};
