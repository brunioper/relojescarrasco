import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo-mark";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <LogoMark size={64} className="text-gold" />
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
