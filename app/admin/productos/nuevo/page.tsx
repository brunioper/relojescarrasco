import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Nuevo reloj" };

export default async function NewProductPage() {
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
          <h1 className="font-serif text-2xl">Nuevo reloj</h1>
          <p className="text-sm text-muted-foreground">
            Luego de crearlo podrá cargar fotos, compra, costos y precio.
          </p>
        </div>
      </div>
      <ProductForm />
    </div>
  );
}
