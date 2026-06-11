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
export type TagRead = components["schemas"]["TagRead"];
export type TagCreate = components["schemas"]["TagCreate"];
export type TagUpdate = components["schemas"]["TagUpdate"];
export type RecurringRead = components["schemas"]["RecurringRead"];
export type RecurringCreate = components["schemas"]["RecurringCreate"];
export type RecurringUpdate = components["schemas"]["RecurringUpdate"];
export type RecurringRunResult = components["schemas"]["RecurringRunResult"];
export type RecurrenceFrequency = components["schemas"]["RecurrenceFrequency"];
export type SavingsGoalRead = components["schemas"]["SavingsGoalRead"];
export type SavingsGoalCreate = components["schemas"]["SavingsGoalCreate"];
export type SavingsGoalUpdate = components["schemas"]["SavingsGoalUpdate"];
export type SavingsGoalContribute = components["schemas"]["SavingsGoalContribute"];
export type CategorizationRuleRead = components["schemas"]["CategorizationRuleRead"];
export type CategorizationRuleCreate = components["schemas"]["CategorizationRuleCreate"];
export type CategorizationRuleUpdate = components["schemas"]["CategorizationRuleUpdate"];
export type SuggestResponse = components["schemas"]["SuggestResponse"];
export type TreemapData = components["schemas"]["TreemapData"];
export type DayAmount = components["schemas"]["DayAmount"];
export type SankeyData = components["schemas"]["SankeyData"];

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
    treemap: (year: number, month?: number) => {
      const qs = new URLSearchParams({ year: String(year) });
      if (month != null) qs.set("month", String(month));
      return apiFetch<TreemapData>(`/api/dashboard/treemap?${qs}`);
    },
    calendar: (year: number) =>
      apiFetch<DayAmount[]>(`/api/dashboard/calendar?year=${year}`),
    sankey: (year: number, month?: number) => {
      const qs = new URLSearchParams({ year: String(year) });
      if (month != null) qs.set("month", String(month));
      return apiFetch<SankeyData>(`/api/dashboard/sankey?${qs}`);
    },
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

  recurring: {
    list: () => apiFetch<RecurringRead[]>("/api/recurring"),
    get: (id: number) => apiFetch<RecurringRead>(`/api/recurring/${id}`),
    create: (data: RecurringCreate) =>
      apiFetch<RecurringRead>("/api/recurring", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: RecurringUpdate) =>
      apiFetch<RecurringRead>(`/api/recurring/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      apiFetch<void>(`/api/recurring/${id}`, { method: "DELETE" }),
    run: () =>
      apiFetch<RecurringRunResult>("/api/recurring/run", { method: "POST" }),
  },

  savingsGoals: {
    list: () => apiFetch<SavingsGoalRead[]>("/api/savings-goals"),
    get: (id: number) => apiFetch<SavingsGoalRead>(`/api/savings-goals/${id}`),
    create: (data: SavingsGoalCreate) =>
      apiFetch<SavingsGoalRead>("/api/savings-goals", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: SavingsGoalUpdate) =>
      apiFetch<SavingsGoalRead>(`/api/savings-goals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      apiFetch<void>(`/api/savings-goals/${id}`, { method: "DELETE" }),
    contribute: (id: number, data: SavingsGoalContribute) =>
      apiFetch<SavingsGoalRead>(`/api/savings-goals/${id}/contribute`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  categorizationRules: {
    list: () => apiFetch<CategorizationRuleRead[]>("/api/categorization-rules"),
    create: (data: CategorizationRuleCreate) =>
      apiFetch<CategorizationRuleRead>("/api/categorization-rules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: CategorizationRuleUpdate) =>
      apiFetch<CategorizationRuleRead>(`/api/categorization-rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      apiFetch<void>(`/api/categorization-rules/${id}`, { method: "DELETE" }),
    suggest: (concept: string) =>
      apiFetch<SuggestResponse | null>(
        `/api/categorization-rules/suggest?concept=${encodeURIComponent(concept)}`,
      ),
  },

  tags: {
    list: () => apiFetch<TagRead[]>("/api/tags"),
    create: (data: TagCreate) =>
      apiFetch<TagRead>("/api/tags", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: TagUpdate) =>
      apiFetch<TagRead>(`/api/tags/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/tags/${id}`, { method: "DELETE" }),
    attachToTransaction: (transactionId: number, tagId: number) =>
      apiFetch<TransactionRead>(`/api/transactions/${transactionId}/tags/${tagId}`, {
        method: "POST",
      }),
    detachFromTransaction: (transactionId: number, tagId: number) =>
      apiFetch<TransactionRead>(`/api/transactions/${transactionId}/tags/${tagId}`, {
        method: "DELETE",
      }),
    setOnTransaction: (transactionId: number, tagIds: number[]) =>
      apiFetch<TransactionRead>(`/api/transactions/${transactionId}/tags`, {
        method: "PUT",
        body: JSON.stringify(tagIds),
      }),
  },
};
