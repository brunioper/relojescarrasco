"use client";

import * as React from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import type { ProductInput } from "@/lib/validation/schemas";
import { MAX_AI_IMAGES, type FormSuggestion } from "@/lib/ai/product-suggestion";
import { ACCEPTED_IMAGE_TYPES, prepareImagesForAi } from "@/lib/images-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldKey =
  | "name"
  | "brand"
  | "model"
  | "reference_number"
  | "movement"
  | "case_material"
  | "strap_material"
  | "diameter_mm"
  | "public_description";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "brand", label: "Marca" },
  { key: "model", label: "Modelo" },
  { key: "reference_number", label: "Referencia" },
  { key: "movement", label: "Movimiento" },
  { key: "diameter_mm", label: "Diámetro" },
  { key: "case_material", label: "Material de caja" },
  { key: "strap_material", label: "Material de correa" },
  { key: "public_description", label: "Descripción pública" },
];

const MOVEMENT_LABELS: Record<string, string> = {
  automatico: "Automático",
  manual: "Manual (cuerda)",
  cuarzo: "Cuarzo",
  solar: "Solar",
  otro: "Otro",
};

function display(key: FieldKey, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (key === "movement") return MOVEMENT_LABELS[String(value)] ?? String(value);
  if (key === "diameter_mm") return `${value} mm`;
  return String(value);
}

type Result = {
  suggestion: FormSuggestion;
  costUsd: number;
  monthUsd: number;
  budgetUsd: number;
};

const formatUsd = (value: number) =>
  `US$ ${value.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Completa la ficha a partir de las fotos. Nunca guarda nada: propone
 * valores y la persona elige cuáles pasar al formulario.
 */
export function AiAssist({
  enabled,
  category,
  productId,
  photoCount = 0,
  files,
  onFilesChange,
  currentValues,
  onApply,
}: {
  enabled: boolean;
  category: "reloj" | "accesorio";
  productId?: string;
  /** Fotos ya cargadas en el producto (al editar). */
  photoCount?: number;
  /** Fotos elegidas para un producto nuevo (se suben al crearlo). */
  files: File[];
  onFilesChange: (files: File[]) => void;
  currentValues: () => Partial<ProductInput>;
  onApply: (values: Partial<Pick<ProductInput, FieldKey>>) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [hint, setHint] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [selected, setSelected] = React.useState<Set<FieldKey>>(new Set());

  const previews = React.useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  React.useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const isNew = !productId;
  const canRun = enabled && !loading && (isNew ? files.length > 0 : photoCount > 0);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const valid = Array.from(list).filter((file) => ACCEPTED_IMAGE_TYPES.includes(file.type));
    if (valid.length < list.length) toast.error("Algunas fotos no son JPG, PNG ni WebP.");
    const next = [...files, ...valid].slice(0, MAX_AI_IMAGES);
    if (files.length + valid.length > MAX_AI_IMAGES) {
      toast.message(`Se usan hasta ${MAX_AI_IMAGES} fotos.`);
    }
    onFilesChange(next);
  };

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const body = isNew
        ? { category, hint: hint.trim() || undefined, images: await prepareImagesForAi(files) }
        : { category, hint: hint.trim() || undefined, productId };
      const response = await fetch("/api/admin/ai/detectar-producto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        toast.error(data?.error ?? "No se pudo completar la ficha con IA. Podés cargarla a mano.");
        return;
      }
      const suggestion = data.suggestion as FormSuggestion;
      const current = currentValues();
      // Por defecto solo se marcan los campos que todavía están vacíos.
      const preselected = new Set<FieldKey>();
      for (const { key } of FIELDS) {
        const suggested = suggestion[key];
        if (suggested === null || suggested === "") continue;
        const existing = current[key];
        const untouched =
          existing === undefined ||
          existing === null ||
          existing === "" ||
          (key === "movement" && existing === "automatico");
        if (untouched) preselected.add(key);
      }
      setSelected(preselected);
      setResult({
        suggestion,
        costUsd: data.costUsd,
        monthUsd: data.monthUsd,
        budgetUsd: data.budgetUsd,
      });
    } catch {
      toast.error("No se pudo leer las fotos. Probá de nuevo o cargá la ficha a mano.");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result) return;
    const values: Record<string, unknown> = {};
    for (const key of selected) values[key] = result.suggestion[key];
    onApply(values as Partial<Pick<ProductInput, FieldKey>>);
    toast.success("Ficha completada. Revisala antes de guardar.");
    setResult(null);
  };

  const rows = result
    ? FIELDS.filter(({ key }) => {
        const value = result.suggestion[key];
        return value !== null && value !== "";
      })
    : [];
  const current = result ? currentValues() : {};

  return (
    <section
      aria-labelledby="ai-assist-title"
      className="rounded-xl border border-gold/50 bg-accent/40 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
          <Sparkles className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <h2 id="ai-assist-title" className="text-base font-semibold">
            Completar la ficha con las fotos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La IA lee lo que se ve en las fotos (marca, modelo, referencia, materiales) y propone la
            ficha. Vos elegís qué usar. Año, estado, caja y papeles los completás a mano.
          </p>
        </div>
      </div>

      {!enabled ? (
        <p className="mt-4 rounded-md border border-dashed bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          Todavía no está activada: falta cargar la clave de la API (paso 4 de BLOQUEOS.md).
          Mientras tanto, la ficha se carga a mano como siempre.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {isNew ? (
            <div>
              <div className="flex flex-wrap gap-2">
                {previews.map((url, i) => (
                  <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local */}
                    <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Quitar foto ${i + 1}`}
                      onClick={() => onFilesChange(files.filter((_, index) => index !== i))}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_AI_IMAGES && (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex h-20 min-w-20 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-gold/50 bg-background/60 px-3 text-xs text-muted-foreground hover:border-gold hover:text-foreground"
                  >
                    <ImagePlus className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                    {files.length === 0 ? "Elegir fotos" : "Agregar"}
                  </button>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                multiple
                className="hidden"
                aria-label="Fotos para completar la ficha"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Hasta {MAX_AI_IMAGES} fotos. Sirven más las del frente, el fondo y la hebilla. Al
                crear el producto, estas fotos quedan cargadas.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {photoCount > 0
                ? `Se usan las ${Math.min(photoCount, MAX_AI_IMAGES)} fotos ya cargadas de este producto.`
                : "Este producto todavía no tiene fotos: subilas en la pestaña Imágenes."}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ai-hint">Dato que quieras aclararle (opcional)</Label>
            <Input
              id="ai-hint"
              value={hint}
              maxLength={300}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Ej.: es un Seamaster de los años 60"
            />
          </div>

          <Button type="button" onClick={run} disabled={!canRun}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {loading ? "Mirando las fotos…" : "Completar ficha"}
          </Button>

          {result && (
            <div className="rounded-lg border bg-background p-4" aria-live="polite">
              <p className="text-sm font-semibold">Esto es lo que encontró</p>
              {rows.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No pudo leer datos claros en estas fotos. Probá con una foto más nítida del frente
                  o del fondo.
                </p>
              ) : (
                <ul className="mt-3 divide-y">
                  {rows.map(({ key, label }) => {
                    const suggested = display(key, result.suggestion[key]);
                    const existing = display(key, current[key]);
                    const replaces = existing !== "" && existing !== suggested;
                    return (
                      <li key={key}>
                        <label className="flex cursor-pointer items-start gap-3 py-2.5">
                          <Checkbox
                            className="mt-0.5"
                            checked={selected.has(key)}
                            onCheckedChange={(checked) =>
                              setSelected((previous) => {
                                const next = new Set(previous);
                                if (checked) next.add(key);
                                else next.delete(key);
                                return next;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                              {label}
                            </span>
                            <span className="block whitespace-pre-line break-words">{suggested}</span>
                            {replaces && (
                              <span className="mt-0.5 block text-xs text-amber-700">
                                Reemplaza lo que escribiste: {existing.slice(0, 80)}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {result.suggestion.extras.length > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  También vio:{" "}
                  {result.suggestion.extras.map((e) => `${e.label.toLowerCase()} ${e.value}`).join(" · ")}
                </p>
              )}

              {result.suggestion.uncertain.length > 0 && (
                <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <p className="font-medium">Para revisar a mano</p>
                  <ul className="mt-1 list-disc pl-5">
                    {result.suggestion.uncertain.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button type="button" onClick={apply} disabled={selected.size === 0}>
                  Pasar a la ficha
                </Button>
                <Button type="button" variant="ghost" onClick={() => setResult(null)}>
                  Descartar
                </Button>
                <p className="text-xs text-muted-foreground">
                  Esta lectura costó {formatUsd(result.costUsd)}. Este mes: {formatUsd(result.monthUsd)}{" "}
                  de {formatUsd(result.budgetUsd)}.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
