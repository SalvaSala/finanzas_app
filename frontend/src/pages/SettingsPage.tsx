import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Trash2, AlertTriangle } from "lucide-react";

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

// ── Delete database dialog ────────────────────────────────────────────────────

function DeleteDatabaseDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Borrar base de datos
          </DialogTitle>
          <DialogDescription>
            Se eliminarán <strong>todos los datos</strong> permanentemente. Esta acción no se puede
            deshacer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Borrando…" : "Borrar"}
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDeleteDatabase() {
    setDeleting(true);
    try {
      const res = await fetch("/api/backup", { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Error desconocido");
      }
      toast.success("Base de datos borrada. Recargando…");
      setTimeout(() => window.location.reload(), 1000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al borrar la base de datos");
      setDeleting(false);
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

      <Separator />

      {/* Danger zone */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-destructive">Zona de peligro</h2>
        <p className="text-sm text-muted-foreground">
          Borrar la base de datos eliminará todos tus datos permanentemente.{" "}
          <strong className="text-foreground">
            Descarga una copia de seguridad antes de continuar.
          </strong>
        </p>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <a href="/api/backup" download>
              <Download className="mr-2 h-4 w-4" />
              Descargar copia de seguridad
            </a>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Borrar base de datos
          </Button>
        </div>
      </div>

      <DeleteDatabaseDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteDatabase}
        pending={deleting}
      />
    </div>
  );
}
