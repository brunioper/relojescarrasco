import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPublicSettings } from "@/services/settings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Sobre nosotros",
  description:
    "Relojes Carrasco: compra y venta de relojes de colección y usados en Montevideo, Uruguay. Conocé cómo trabajamos.",
};

export default async function AboutPage() {
  const settings = await getPublicSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-serif text-3xl md:text-4xl">Sobre nosotros</h1>

      <div className="prose-sm mt-8 space-y-6 leading-relaxed text-muted-foreground">
        <p>
          {settings.businessName} nace de una pasión de años por la relojería mecánica y los objetos
          bien hechos. Compramos y vendemos relojes de colección y usados en Uruguay, con un catálogo
          reducido y elegido pieza por pieza.
        </p>
        <p>
          Cada reloj que publicamos pasó por nuestras manos: lo revisamos, lo documentamos y, cuando lo
          necesita, lo enviamos a service o reparación con relojeros de confianza antes de ofrecerlo.
          Preferimos vender menos relojes, pero venderlos bien.
        </p>
        <h2 className="font-serif text-xl text-foreground">Cómo seleccionamos los relojes</h2>
        <p>
          Buscamos piezas originales, con movimientos en buen estado y una historia clara: relojes de
          coleccionistas, familias o viajeros. Verificamos referencias y números de serie, evaluamos el
          estado estético y mecánico, y descartamos lo que no cumple nuestro estándar.
        </p>
        <h2 className="font-serif text-xl text-foreground">Cómo comprar</h2>
        <p>
          El catálogo muestra los precios en dólares americanos con su conversión aproximada a pesos
          uruguayos. Las operaciones se coordinan personalmente por WhatsApp: podés ver el reloj antes de
          decidir y lo entregamos en funcionamiento, con su caja y documentación cuando corresponde.
        </p>
        <h2 className="font-serif text-xl text-foreground">¿Vendés tu reloj?</h2>
        <p>
          También compramos relojes de colección y gestionamos búsquedas de modelos específicos.
          Escribinos con fotos y datos del reloj y te respondemos a la brevedad.
        </p>
      </div>

      <div className="mt-10 flex gap-3">
        <Button asChild>
          <Link href="/catalogo">Ver catálogo</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/contacto">Contacto</Link>
        </Button>
      </div>
    </div>
  );
}
