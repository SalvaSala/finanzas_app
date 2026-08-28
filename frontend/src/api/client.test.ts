import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./client";

/** Devuelve la URL con la que se llamó a `fetch` en la invocación `n`. */
function calledUrl(fetchMock: ReturnType<typeof vi.fn>, n = 0): string {
  return String(fetchMock.mock.calls[n][0]);
}

function mockOk(body: unknown = []): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transactions.list — construcción de la query", () => {
  it("no añade query string cuando no hay filtros", async () => {
    const f = mockOk();
    await api.transactions.list();
    expect(calledUrl(f)).toBe("/api/transactions");
  });

  it("incluye año y mes", async () => {
    const f = mockOk();
    await api.transactions.list({ year: 2026, month: 6 });
    expect(calledUrl(f)).toContain("year=2026");
    expect(calledUrl(f)).toContain("month=6");
  });

  it("incluye el mes 0 en lugar de descartarlo por ser falsy", async () => {
    // Se comprueba con `!= null`, así que un 0 legítimo debe viajar.
    const f = mockOk();
    await api.transactions.list({ month: 0 });
    expect(calledUrl(f)).toContain("month=0");
  });

  it("incluye subcategory_id", async () => {
    const f = mockOk();
    await api.transactions.list({ subcategory_id: 12 });
    expect(calledUrl(f)).toContain("subcategory_id=12");
  });

  it("envía los flags booleanos solo cuando son true", async () => {
    const f = mockOk();
    await api.transactions.list({ no_category: true, no_subcategory: false });
    expect(calledUrl(f)).toContain("no_category=true");
    expect(calledUrl(f)).not.toContain("no_subcategory");
  });

  it("omite la búsqueda vacía", async () => {
    const f = mockOk();
    await api.transactions.list({ search: "" });
    expect(calledUrl(f)).toBe("/api/transactions");
  });

  it("codifica los caracteres especiales de la búsqueda", async () => {
    const f = mockOk();
    await api.transactions.list({ search: "café & té" });
    expect(calledUrl(f)).toContain("search=caf%C3%A9+%26+t%C3%A9");
  });

  it("descarta los filtros nulos", async () => {
    const f = mockOk();
    await api.transactions.list({ year: 2026, category_id: null, account_id: null });
    const url = calledUrl(f);
    expect(url).toContain("year=2026");
    expect(url).not.toContain("category_id");
    expect(url).not.toContain("account_id");
  });
});

describe("apiFetch — manejo de respuestas", () => {
  it("extrae el mensaje del campo `detail` en los errores", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "La categoría no existe." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    await expect(api.categories.list()).rejects.toThrow("La categoría no existe.");
  });

  it("cae al status cuando el cuerpo no es JSON", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("<html>error</html>", { status: 500, statusText: "Server Error" }),
    ) as unknown as typeof fetch;

    await expect(api.categories.list()).rejects.toThrow(/500/);
  });

  it("devuelve undefined en un 204 sin cuerpo", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;

    await expect(api.transactions.delete(1)).resolves.toBeUndefined();
  });

  it("manda Content-Type JSON en las escrituras", async () => {
    const f = mockOk({ id: 1 });
    await api.categories.create({ name: "Ocio", type: "expense" });

    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Ocio", type: "expense" });
  });
});

describe("backup", () => {
  it("restaura enviando el fichero como FormData sin forzar Content-Type", async () => {
    const f = mockOk({ status: "ok", message: "Restaurada." });
    const file = new File(["datos"], "copia.db");

    await api.backup.restore(file);

    expect(calledUrl(f)).toBe("/api/backup/restore");
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    // El navegador debe poner el boundary multipart por su cuenta.
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("borra la base de datos con DELETE", async () => {
    const f = mockOk({ status: "ok", message: "Borrada." });
    await api.backup.deleteDatabase();

    expect(calledUrl(f)).toBe("/api/backup");
    expect((f.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });

  it("propaga el error del servidor al borrar", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "Fichero bloqueado." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    await expect(api.backup.deleteDatabase()).rejects.toThrow("Fichero bloqueado.");
  });
});

describe("dashboard", () => {
  it("omite el mes en la vista anual", async () => {
    const f = mockOk({});
    await api.dashboard.summary(2026);
    expect(calledUrl(f)).toBe("/api/dashboard/summary?year=2026");
  });

  it("incluye el mes en la vista mensual", async () => {
    const f = mockOk({});
    await api.dashboard.summary(2026, 6);
    expect(calledUrl(f)).toContain("month=6");
  });
});
