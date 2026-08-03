import Link from "next/link";
import { Watch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 text-gold">
        <Watch className="h-8 w-8" strokeWidth={1.5} />
      </span>
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Error 404</p>
        <h1 className="mt-2 font-serif text-3xl">Página no encontrada</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          La página que buscás no existe o el reloj ya no está publicado en el catálogo.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/catalogo">Ver catálogo</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
