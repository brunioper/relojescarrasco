import Link from "next/link";
import { MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bloque de confianza: autenticidad, garantía y local físico.
 *
 * Los textos describen cómo trabaja el negocio sin prometer plazos ni
 * condiciones concretas (esos detalles viven en /autenticidad-y-garantia
 * y los define el dueño).
 */
const POINTS = [
  {
    icon: ShieldCheck,
    title: "Autenticidad verificada",
    text: "Revisamos cada reloj y verificamos su originalidad antes de publicarlo.",
  },
  {
    icon: Sparkles,
    title: "Garantía por escrito",
    text: "Cada reloj se entrega revisado, en funcionamiento y con garantía.",
  },
  {
    icon: MapPin,
    title: "Local en Carrasco",
    text: "Podés ver el reloj en persona en Montevideo antes de decidir.",
  },
] as const;

export function TrustPoints({
  variant = "row",
  className,
}: {
  variant?: "row" | "stack";
  className?: string;
}) {
  return (
    <section aria-label="Por qué comprar en Relojes Carrasco" className={className}>
      <ul
        className={cn(
          "grid gap-6",
          variant === "row" ? "sm:grid-cols-3 sm:gap-8" : "grid-cols-1 gap-5"
        )}
      >
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold-deep">
              <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-foreground">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm">
        <Link
          href="/autenticidad-y-garantia"
          className="underline decoration-gold underline-offset-4 hover:text-gold-deep"
        >
          Cómo garantizamos cada reloj
        </Link>
      </p>
    </section>
  );
}
