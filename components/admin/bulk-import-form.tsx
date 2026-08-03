"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import { bulkImportProductsAction, type BulkImportRowResult } from "@/app/admin/productos/importar/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function BulkImportForm() {
  const router = useRouter();
  const [importing, setImporting] = React.useState(false);
  const [results, setResults] = React.useState<BulkImportRowResult[] | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Solo se aceptan archivos .xlsx (el de la plantilla).");
      return;
    }
    setImporting(true);
    setResults(null);

    const formData = new FormData();
    formData.set("file", file);
    const result = await bulkImportProductsAction(formData);
    setImporting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setResults(result.data.results);
    const created = result.data.results.filter((r) => r.ok).length;
    const errors = result.data.results.length - created;

    if (created > 0) {
      toast.success(
        `${created} ${created === 1 ? "reloj creado" : "relojes creados"}.` +
          (errors > 0 ? ` ${errors} ${errors === 1 ? "fila con error" : "filas con error"}.` : "")
      );
      router.refresh();
    } else {
      toast.error("No se creó ningún reloj. Revise los errores por fila.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <a href="/api/admin/products/import-template" download>
            <Download className="h-4 w-4" /> Descargar plantilla
          </a>
        </Button>
        <Button onClick={() => inputRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Subir planilla completa
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void submit(file);
            e.target.value = "";
          }}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Descargá la plantilla, completá una fila por reloj —solo <strong>nombre</strong> y{" "}
        <strong>marca</strong> son obligatorios, el resto puede quedar vacío— y subila. Los relojes
        se crean <strong>sin publicar</strong>: revisalos, cargales fotos y publicalos desde{" "}
        <Link href="/admin/productos" className="text-gold hover:underline">
          el listado
        </Link>
        . Máximo 300 filas por archivo.
      </p>

      {results && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Fila</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.row}>
                  <TableCell className="text-sm">{r.row}</TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={r.ok ? "success" : "destructive"} className="mr-2">
                      {r.ok ? "OK" : "Error"}
                    </Badge>
                    {r.message}
                    {r.ok && r.productId && (
                      <Link
                        href={`/admin/productos/${r.productId}`}
                        className="ml-2 text-gold hover:underline"
                      >
                        Ver →
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
