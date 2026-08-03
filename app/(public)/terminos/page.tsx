import type { Metadata } from "next";
import { getPublicSettings } from "@/services/settings";
import { CURRENCY_DISCLAIMER } from "@/lib/formatting/currency";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Términos y condiciones",
};

export default async function TermsPage() {
  const settings = await getPublicSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-serif text-3xl">Términos y condiciones</h1>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p className="whitespace-pre-line">{settings.termsText}</p>

        <h2 className="pt-4 font-serif text-lg text-foreground">Precios y monedas</h2>
        <p>
          Los precios del catálogo se expresan en dólares americanos (US$). {CURRENCY_DISCLAIMER} El
          precio final de una operación se acuerda al momento de concretarla.
        </p>

        <h2 className="pt-4 font-serif text-lg text-foreground">Estado de los relojes</h2>
        <p>
          Los relojes publicados son usados o de colección. Describimos su estado con la mayor precisión
          posible e incluimos fotografías reales de cada pieza. Salvo indicación en contrario, los
          relojes se entregan revisados y en funcionamiento.
        </p>

        <h2 className="pt-4 font-serif text-lg text-foreground">Disponibilidad</h2>
        <p>
          El catálogo se actualiza con frecuencia, pero un reloj marcado como disponible puede haberse
          reservado o vendido recientemente. La disponibilidad definitiva se confirma por WhatsApp.
        </p>
      </div>
    </div>
  );
}
