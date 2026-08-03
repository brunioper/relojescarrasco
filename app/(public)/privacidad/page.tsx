import type { Metadata } from "next";
import { getPublicSettings } from "@/services/settings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Política de privacidad",
  robots: { index: true },
};

export default async function PrivacyPage() {
  const settings = await getPublicSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-serif text-3xl">Política de privacidad</h1>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p className="whitespace-pre-line">{settings.privacyText}</p>
        <h2 className="pt-4 font-serif text-lg text-foreground">Datos que recopilamos</h2>
        <p>
          Solo recopilamos los datos que nos proporcionás voluntariamente al contactarnos (nombre,
          teléfono, email) y los estrictamente necesarios para concretar una compra o venta. No usamos
          cookies de seguimiento publicitario.
        </p>
        <h2 className="pt-4 font-serif text-lg text-foreground">Uso y conservación</h2>
        <p>
          Usamos tus datos únicamente para responder consultas y gestionar operaciones. No los
          compartimos con terceros ni los usamos para envíos masivos. Podés solicitar la eliminación de
          tus datos escribiéndonos por cualquiera de nuestros canales de contacto.
        </p>
      </div>
    </div>
  );
}
