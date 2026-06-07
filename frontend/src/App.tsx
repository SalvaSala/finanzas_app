import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function App() {
  const { isFetching, isError, refetch } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.health(),
    retry: 1,
  });

  const status = isFetching ? "loading" : isError ? "error" : "ok";
  const label = { loading: "Conectando…", ok: "Conectado ✓", error: "Sin conexión con el backend" }[status];
  const cls = { loading: "text-muted-foreground", ok: "text-income", error: "text-expense" }[status];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">FinApp</CardTitle>
          <CardDescription>
            App de finanzas personales — comprobación de conexión con el backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <span className="text-sm text-muted-foreground">Estado del backend</span>
            <span className={cn("text-sm font-medium", cls)}>{label}</span>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Volver a comprobar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
