import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { BulkImportForm } from "@/components/admin/bulk-import-form";

export const metadata = { title: "Importar relojes en lote" };

export default async function BulkImportPage() {
  await requireAdminPage();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/productos" aria-label="Volver a productos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-serif text-2xl">Importar relojes en lote</h1>
          <p className="text-sm text-muted-foreground">
            Cargá varios relojes de una sola vez desde una planilla Excel.
          </p>
        </div>
      </div>
      <BulkImportForm />
    </div>
  );
}
