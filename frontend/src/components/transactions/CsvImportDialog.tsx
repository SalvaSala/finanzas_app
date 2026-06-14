import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft, Tag } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import type { AccountRead, ColumnMapping, CsvImportMappedResult, CsvPreviewResult } from "@/api/client";
import { api } from "@/api/client";
import { useAccounts } from "@/hooks/useAccounts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "upload" | "map" | "result";

const NONE = "__none__";

const APP_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "date_col",        label: "Fecha",             required: true  },
  { key: "concept_col",     label: "Concepto",          required: true  },
  { key: "amount_col",      label: "Importe",           required: true  },
  { key: "description_col", label: "Descripción",       required: false },
  { key: "category_col",    label: "Categoría (CSV)",   required: false },
];

const DATE_FORMATS = [
  { value: "auto",  label: "Detectar automáticamente" },
  { value: "iso",   label: "YYYY-MM-DD" },
  { value: "mdy",   label: "MM/DD/YYYY" },
  { value: "dmy",   label: "DD/MM/YYYY" },
];

const DECIMAL_SEPS = [
  { value: "auto",  label: "Detectar automáticamente" },
  { value: "dot",   label: "Punto  (1.234,56 → no)" },
  { value: "comma", label: "Coma   (1.234,56 → sí)" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ── Step 1 — Upload ───────────────────────────────────────────────────────────

interface Step1Props {
  onPreview: (file: File, preview: CsvPreviewResult) => void;
}

function StepUpload({ onPreview }: Step1Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File) {
    setFile(f);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) handleFile(f);
  }

  async function handleNext() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const preview = await api.transactions.csvPreview(file);
      onPreview(file, preview);
    } catch {
      setError("No se pudo leer el archivo. Comprueba que es un CSV válido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
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
              Compatible con HomeBank, cualquier banco u otra app de finanzas
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!file || loading}>
          {loading ? "Analizando…" : "Analizar CSV →"}
        </Button>
      </div>
    </div>
  );
}

// ── Step 2 — Column mapping ───────────────────────────────────────────────────

interface Step2Props {
  file: File;
  preview: CsvPreviewResult;
  accounts: AccountRead[];
  onBack: () => void;
  onImport: (result: CsvImportMappedResult) => void;
}

function StepMap({ file, preview, accounts, onBack, onImport }: Step2Props) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<string>(
    accounts.length === 1 ? String(accounts[0].id) : NONE
  );
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({
    date_format: "auto",
    decimal_sep: "auto",
    sign_convention: "signed",
  });
  const [loading, setLoading] = useState(false);

  function setCol(key: keyof ColumnMapping, value: string) {
    setMapping((m) => ({ ...m, [key]: value === NONE ? null : value }));
  }

  const requiredFilled =
    accountId !== NONE &&
    mapping.date_col &&
    mapping.concept_col &&
    mapping.amount_col;

  async function handleImport() {
    if (!requiredFilled) return;
    setLoading(true);
    try {
      const result = await api.transactions.csvImportMapped(
        file,
        Number(accountId),
        {
          date_col: mapping.date_col!,
          concept_col: mapping.concept_col!,
          amount_col: mapping.amount_col!,
          description_col: mapping.description_col ?? null,
          category_col: mapping.category_col ?? null,
          date_format: mapping.date_format ?? "auto",
          decimal_sep: mapping.decimal_sep ?? "auto",
          sign_convention: mapping.sign_convention ?? "signed",
        }
      );
      if (result.imported > 0) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["budgets"] });
      }
      onImport(result);
    } catch (err) {
      toast.error((err as Error).message || "Error al importar el CSV");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Preview table */}
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Vista previa · Separador detectado: <code className="font-mono">{preview.separator === ";" ? "punto y coma (;)" : "coma (,)"}</code>
        </p>
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                {preview.headers.map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.preview_rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 text-muted-foreground whitespace-nowrap max-w-[120px] truncate">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column mapping */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Mapear columnas</p>
        <div className="grid grid-cols-2 gap-3">
          {APP_FIELDS.map(({ key, label, required }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">
                {label}
                {required && <span className="ml-0.5 text-destructive">*</span>}
              </Label>
              <Select
                value={(mapping[key] as string | null | undefined) ?? NONE}
                onValueChange={(v) => setCol(key, v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={required ? "Seleccionar…" : "No importar"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{required ? "— Seleccionar —" : "No importar"}</SelectItem>
                  {preview.headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Format options */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Formato de fecha</Label>
          <Select
            value={mapping.date_format ?? "auto"}
            onValueChange={(v) => setMapping((m) => ({ ...m, date_format: v }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Separador decimal</Label>
          <Select
            value={mapping.decimal_sep ?? "auto"}
            onValueChange={(v) => setMapping((m) => ({ ...m, decimal_sep: v }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DECIMAL_SEPS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Account */}
      <div className="space-y-1">
        <Label className="text-xs">
          Cuenta destino <span className="text-destructive">*</span>
        </Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Seleccionar cuenta…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Seleccionar —</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-between gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Volver
        </Button>
        <Button onClick={handleImport} disabled={!requiredFilled || loading}>
          {loading ? "Importando…" : "Importar"}
        </Button>
      </div>
    </div>
  );
}

// ── Step 3 — Results ──────────────────────────────────────────────────────────

interface Step3Props {
  result: CsvImportMappedResult;
  onClose: () => void;
}

function StepResult({ result, onClose }: Step3Props) {
  const navigate = useNavigate();

  function goToUncategorized() {
    navigate("/transacciones", { state: { initialNoCategorized: true } });
    onClose();
  }

  return (
    <div className="space-y-4">
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

      {result.uncategorized > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <Tag className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="flex-1 space-y-2">
            <p className="text-sm">
              <strong>{result.uncategorized}</strong> movimiento{result.uncategorized !== 1 ? "s" : ""} importado{result.uncategorized !== 1 ? "s" : ""} sin categoría porque no coincidió con ninguna categoría de la app.
            </p>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={goToUncategorized}>
              Ver movimientos sin categoría →
            </Button>
          </div>
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="rounded-lg border border-expense/30 bg-expense/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-expense">
            <AlertCircle className="h-4 w-4" />
            Filas con error ({result.errors.length})
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

      <div className="flex justify-end">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

// ── Dialog wrapper ────────────────────────────────────────────────────────────

export function CsvImportDialog({ open, onOpenChange }: Props) {
  const { data: accounts = [] } = useAccounts();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [result, setResult] = useState<CsvImportMappedResult | null>(null);

  const STEP_LABELS: Record<Step, string> = {
    upload: "1. Subir archivo",
    map:    "2. Mapear columnas",
    result: "3. Resultado",
  };

  function handleClose() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    onOpenChange(false);
  }

  function handlePreview(f: File, p: CsvPreviewResult) {
    setFile(f);
    setPreview(p);
    setStep("map");
  }

  function handleImport(r: CsvImportMappedResult) {
    setResult(r);
    setStep("result");
    if (r.imported > 0) {
      toast.success(
        `${r.imported} movimiento${r.imported !== 1 ? "s" : ""} importado${r.imported !== 1 ? "s" : ""}`
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar movimientos desde CSV</DialogTitle>
          <p className="text-xs text-muted-foreground">{STEP_LABELS[step]}</p>
        </DialogHeader>

        {step === "upload" && (
          <StepUpload onPreview={handlePreview} />
        )}

        {step === "map" && preview && file && (
          <StepMap
            file={file}
            preview={preview}
            accounts={accounts}
            onBack={() => setStep("upload")}
            onImport={handleImport}
          />
        )}

        {step === "result" && result && (
          <StepResult result={result} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
