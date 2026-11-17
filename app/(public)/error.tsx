"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-deep">
        Algo no salió bien
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-tight">No pudimos mostrar esta página</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        Suele resolverse solo en unos segundos. Probá de nuevo o escribinos y te ayudamos
        personalmente.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          Probar de nuevo
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/contacto">Contacto</Link>
        </Button>
      </div>
    </div>
  );
}
