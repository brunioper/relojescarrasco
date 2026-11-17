import Link from "next/link";
import { MapPin, MessageCircle, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bloque de confianza: autenticidad, garantía y local físico.
 *
 * Los textos describen cómo trabaja el negocio sin prometer plazos ni
 * condiciones concretas (esos detalles viven en /autenticidad-y-garantia
 * y los define el dueño).
 */
const ACCESSORY_POINTS = [
  {
    icon: MessageCircle,
    title: "Te ayudamos a elegir",
    text: "Contanos qué reloj tenés y te decimos qué ancho y qué modelo le van.",
  },
  {
    icon: PackageCheck,
    title: "Stock al día",
    text: "El stock de cada medida y color se actualiza con cada venta.",
  },
  {
    icon: MapPin,
    title: "Local en Carrasco",
    text: "Podés verlo en persona en Montevideo antes de decidir.",
  },
] as const;

const WATCH_POINTS = [
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
  kind = "reloj",
  className,
}: {
  variant?: "row" | "stack";
  kind?: "reloj" | "accesorio";
  className?: string;
}) {
  const points = kind === "accesorio" ? ACCESSORY_POINTS : WATCH_POINTS;
  return (
    <section aria-label="Por qué comprar en Relojes Carrasco" className={className}>
      <ul
        className={cn(
          "grid gap-6",
          variant === "row" ? "sm:grid-cols-3 sm:gap-8" : "grid-cols-1 gap-5"
        )}
      >
        {points.map(({ icon: Icon, title, text }) => (
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
      {kind === "reloj" && (
        <p className="mt-5 text-sm">
          <Link
            href="/autenticidad-y-garantia"
            className="underline decoration-gold underline-offset-4 hover:text-gold-deep"
          >
            Cómo garantizamos cada reloj
          </Link>
        </p>
      )}
    </section>
  );
}
