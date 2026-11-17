import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/public/json-ld";
import { getPublicSettings } from "@/services/settings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Autenticidad y garantía",
  description:
    "Cómo verificamos la autenticidad de cada reloj y qué garantía entregamos en Relojes Carrasco, Montevideo.",
  alternates: { canonical: "/autenticidad-y-garantia" },
};

const FAQ = [
  {
    q: "¿Los relojes son originales?",
    a: "Sí. Revisamos cada reloj antes de publicarlo: verificamos la referencia, el número de serie y el estado del movimiento, y descartamos las piezas que no cumplen nuestro estándar.",
  },
  {
    q: "¿Puedo ver el reloj antes de comprarlo?",
    a: "Sí. Coordinamos una visita en Carrasco, Montevideo, para que lo veas y lo pruebes en persona antes de decidir.",
  },
  {
    q: "¿Qué garantía tienen los relojes?",
    a: "Cada reloj se entrega revisado, en funcionamiento y con garantía por escrito. El plazo y las condiciones dependen de cada pieza: te los confirmamos antes de la compra y quedan detallados en el comprobante.",
  },
  {
    q: "¿En qué moneda están los precios?",
    a: "Los precios se publican en dólares americanos. Cuando se muestra un importe en pesos uruguayos, es una conversión aproximada de referencia.",
  },
  {
    q: "¿Compran relojes?",
    a: "Sí. Compramos relojes y también buscamos modelos por encargo. Podés contarnos qué reloj tenés desde la página «Vendé tu reloj».",
  },
] as const;

export default async function AuthenticityPage() {
  const settings = await getPublicSettings();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <JsonLd data={faqJsonLd} />

      <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-deep">
        {settings.businessName}
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">Autenticidad y garantía</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
        Comprar un reloj de calidad es una decisión importante. Por eso trabajamos con pocas piezas,
        elegidas una por una, y respondemos por cada una de ellas.
      </p>

      <section className="mt-12">
        <h2 className="font-serif text-2xl">Cómo verificamos cada reloj</h2>
        <ol className="mt-5 space-y-5 text-base leading-relaxed">
          {[
            [
              "Revisión de originalidad",
              "Verificamos la referencia y el número de serie, y controlamos que caja, esfera, movimiento y brazalete correspondan al modelo.",
            ],
            [
              "Control de funcionamiento",
              "Evaluamos el estado mecánico y estético. Cuando hace falta, el reloj pasa por service con relojeros de confianza antes de publicarse.",
            ],
            [
              "Descripción honesta",
              "Publicamos fotos reales de cada pieza y describimos su estado, e indicamos si incluye caja y papeles.",
            ],
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-4">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/50 font-serif text-base text-gold-deep"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl">Garantía</h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Cada reloj se entrega revisado, en funcionamiento y con garantía por escrito. El plazo y las
          condiciones dependen de cada pieza: te los confirmamos antes de la compra y quedan detallados
          en el comprobante que recibís.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl">Atención personal en Carrasco</h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Atendemos personalmente en Carrasco, Montevideo. Podés ver y probar el reloj antes de
          decidir, y consultarnos lo que necesites antes y después de la compra.
          {settings.address ? ` Dirección: ${settings.address}.` : ""}
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl">Preguntas frecuentes</h2>
        <dl className="mt-5 divide-y border-y">
          {FAQ.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="text-lg font-medium">{item.q}</dt>
              <dd className="mt-2 text-base leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/catalogo">Ver el catálogo</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/contacto">Hacer una consulta</Link>
        </Button>
      </div>
    </div>
  );
}
