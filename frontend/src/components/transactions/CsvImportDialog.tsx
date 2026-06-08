import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import type { ImportResult } from "@/api/client";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CsvImportDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) {
      setFile(f);
      setResult(null);
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    try {
      const res = await api.transactions.importCsv(file);
      setResult(res);
      if (res.imported > 0) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["budgets"] });
        toast.success(`${res.imported} movimiento${res.imported !== 1 ? "s" : ""} importado${res.imported !== 1 ? "s" : ""}`);
      }
    } catch {
      toast.error("Error al procesar el archivo");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar movimientos desde CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          {!result && (
            <div
              className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 px-6 py-8 text-center transition-colors hover:border-muted-foreground/60"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · Haz clic para cambiar
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Arrastra un archivo CSV o haz clic para seleccionarlo</p>
                  <p className="text-xs text-muted-foreground">
                    Columnas: fecha, tipo, concepto, descripcion, importe, cuenta, cuenta_destino, categoria, subcategoria
                  </p>
                </>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <CheckCircle className="h-5 w-5 shrink-0 text-income" />
                <div>
                  <p className="text-sm font-medium">
                    {result.imported} movimiento{result.imported !== 1 ? "s" : ""} importado{result.imported !== 1 ? "s" : ""}
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {result.skipped} fila{result.skipped !== 1 ? "s" : ""} omitida{result.skipped !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-expense/30 bg-expense/5 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-expense">
                    <AlertCircle className="h-4 w-4" />
                    Errores ({result.errors.length})
                  </div>
                  <ul className="max-h-36 overflow-y-auto space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              {result ? "Cerrar" : "Cancelar"}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={!file || loading}>
                {loading ? "Importando…" : "Importar"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
