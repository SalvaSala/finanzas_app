import { useCallback, useEffect, useState } from "react";

import { getHealth } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ConnectionStatus = "loading" | "ok" | "error";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  loading: "Conectando…",
  ok: "Conectado ✓",
  error: "Sin conexión con el backend",
};

const STATUS_CLASS: Record<ConnectionStatus, string> = {
  loading: "text-muted-foreground",
  ok: "text-income",
  error: "text-expense",
};

export function App() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");

  const checkHealth = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await getHealth();
      setStatus(data.status === "ok" ? "ok" : "error");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

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
            <span className="text-sm text-muted-foreground">
              Estado del backend
            </span>
            <span className={cn("text-sm font-medium", STATUS_CLASS[status])}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void checkHealth()}
            disabled={status === "loading"}
          >
            Volver a comprobar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
