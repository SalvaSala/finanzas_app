import type { ReactElement, ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

/**
 * Un QueryClient nuevo por test, sin reintentos ni caché entre pruebas:
 * de lo contrario un fallo simulado tardaría segundos en propagarse y los
 * datos de un test se filtrarían al siguiente.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface Options extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
  /** Ruta inicial del router en memoria. */
  route?: string;
}

/** Renderiza con los providers que la app monta en `App.tsx`. */
export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), route = "/", ...options }: Options = {},
): RenderResult & { queryClient: QueryClient } {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}

/** Wrapper suelto para `renderHook`, que no acepta JSX inline cómodamente. */
export function createWrapper(queryClient: QueryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * `Intl` separa el importe del símbolo de moneda con un espacio duro
 * (NBSP U+00A0, o NNBSP U+202F según la versión de ICU). Escribir ese carácter
 * a pelo en los tests es frágil, así que se normaliza a un espacio normal.
 */
export function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? "").replace(/[\u00a0\u202f]/g, " ");
}

/**
 * Sustituye `fetch` por un doble que resuelve según la URL solicitada.
 *
 * Las claves son fragmentos de URL; gana la primera que encaje. El valor puede
 * ser el cuerpo JSON, o `{ status, body }` para simular errores de la API.
 */
export function mockFetch(routes: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = Object.keys(routes).find((key) => url.includes(key));

    if (match === undefined) {
      return new Response(JSON.stringify({ detail: `Sin ruta simulada para ${url}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const value = routes[match];
    const isErrorSpec =
      typeof value === "object" && value !== null && "status" in value && "body" in value;
    const status = isErrorSpec ? (value as { status: number }).status : 200;
    const body = isErrorSpec ? (value as { body: unknown }).body : value;

    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });

  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}
