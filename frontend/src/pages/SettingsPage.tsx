import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// ── Restore confirm dialog ────────────────────────────────────────────────────

function RestoreDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  filename,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
  filename: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Restaurar copia de seguridad
          </DialogTitle>
          <DialogDescription>
            Se reemplazarán <strong>todos los datos actuales</strong> con los del archivo{" "}
            <strong>{filename}</strong>. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Restaurando…" : "Restaurar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    e.target.value = "";
  }

  async function handleRestore() {
    if (!pendingFile) return;
    setRestoring(true);
    try {
      const body = new FormData();
      body.append("file", pendingFile);
      const res = await fetch("/api/backup/restore", { method: "POST", body });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Error desconocido");
      }
      toast.success("Copia de seguridad restaurada. Recarga la página para ver los datos.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al restaurar");
    } finally {
      setRestoring(false);
      setPendingFile(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Gestiona tu base de datos local.</p>
      </div>

      <Separator />

      {/* Backup section */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Copia de seguridad</h2>
        <p className="text-sm text-muted-foreground">
          Descarga una copia completa de tu base de datos. Guárdala en un lugar seguro para poder
          restaurarla en caso de pérdida.
        </p>
        <Button asChild variant="outline">
          <a href="/api/backup" download>
            <Download className="mr-2 h-4 w-4" />
            Descargar copia de seguridad
          </a>
        </Button>
      </div>

      <Separator />

      {/* Restore section */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Restaurar copia de seguridad</h2>
        <p className="text-sm text-muted-foreground">
          Restaura los datos desde una copia de seguridad anterior.{" "}
          <strong className="text-foreground">
            Los datos actuales se reemplazarán completamente.
          </strong>
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={restoring}
          >
            <Upload className="mr-2 h-4 w-4" />
            Seleccionar archivo…
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,application/octet-stream"
            className="hidden"
            onChange={handleFileChange}
          />
          {pendingFile && (
            <span className="text-sm text-muted-foreground">{pendingFile.name}</span>
          )}
        </div>
      </div>

      <RestoreDialog
        open={pendingFile != null}
        onOpenChange={(v) => !v && setPendingFile(null)}
        onConfirm={handleRestore}
        pending={restoring}
        filename={pendingFile?.name ?? ""}
      />
    </div>
  );
}
