/** Minimal API client. Typed OpenAPI client + React Query hooks arrive in step 5. */

export interface HealthResponse {
  status: string;
}

/** Call the backend health endpoint (proxied to FastAPI under /api in dev). */
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}
