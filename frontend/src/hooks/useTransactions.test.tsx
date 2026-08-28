import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createWrapper, mockFetch } from "@/test/utils";

import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from "./useTransactions";

const TX = { id: 1, concept: "Compra", amount: "10.00", type: "expense" };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = mockFetch({ "/api/transactions": [TX] });
});

describe("useTransactions", () => {
  it("carga la lista de movimientos", async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([TX]);
  });

  it("pasa los filtros a la petición", async () => {
    const { result } = renderHook(() => useTransactions({ year: 2026, month: 6 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0][0])).toContain("year=2026");
  });

  it("cachea por filtros: distintos filtros son distintas queries", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient);

    const first = renderHook(() => useTransactions({ year: 2026 }), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    const second = renderHook(() => useTransactions({ year: 2025 }), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

/**
 * Lo que importa de las mutaciones es que invaliden las queries correctas:
 * si no, la tabla y el dashboard se quedan con datos rancios tras guardar.
 */
describe("mutaciones — invalidación de queries", () => {
  async function expectInvalidates(
    hook: () => { mutateAsync: (arg: never) => Promise<unknown> },
    arg: unknown,
  ) {
    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(hook, { wrapper: createWrapper(queryClient) });

    await result.current.mutateAsync(arg as never);

    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toContain(JSON.stringify(["transactions"]));
    expect(keys).toContain(JSON.stringify(["dashboard"]));
  }

  it("crear invalida movimientos y dashboard", async () => {
    await expectInvalidates(useCreateTransaction, { concept: "Nuevo" });
  });

  it("actualizar invalida movimientos y dashboard", async () => {
    await expectInvalidates(useUpdateTransaction, { id: 1, data: { concept: "Editado" } });
  });

  it("borrar invalida movimientos y dashboard", async () => {
    await expectInvalidates(useDeleteTransaction, 1);
  });

  it("no invalida nada si la mutación falla", async () => {
    fetchMock = mockFetch({ "/api/transactions": { status: 500, body: { detail: "Error" } } });
    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateTransaction(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({ concept: "Nuevo" } as never),
    ).rejects.toThrow();

    expect(spy).not.toHaveBeenCalled();
  });
});
