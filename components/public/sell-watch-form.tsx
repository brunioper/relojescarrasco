"use client";

import * as React from "react";
import { Instagram, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { instagramDmUrl } from "@/lib/inquiry";
import { trackLead } from "@/lib/analytics";
import {
  SELL_CONDITIONS,
  buildSellWatchMessage,
  validateSellWatch,
  type SellWatchInput,
} from "@/lib/sell-watch";

const EMPTY: SellWatchInput = {
  name: "",
  brand: "",
  model: "",
  reference: "",
  year: "",
  condition: "",
  hasBox: false,
  hasPapers: false,
  comments: "",
};

const BUTTON =
  "inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md px-6 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * Formulario "Vendé tu reloj": arma un mensaje ordenado con los datos
 * del reloj y abre Instagram (copiando el mensaje) o WhatsApp (con el
 * mensaje ya cargado). Las fotos se envían en ese mismo chat.
 */
export function SellWatchForm({
  instagramUsername,
  whatsappNumber,
}: {
  instagramUsername: string | null;
  whatsappNumber: string;
}) {
  const [form, setForm] = React.useState<SellWatchInput>(EMPTY);
  const [honeypot, setHoneypot] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const mountedAt = React.useRef(Date.now());

  const set = <K extends keyof SellWatchInput>(key: K, value: SellWatchInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const prepare = (): string | null => {
    // Anti-spam: campo trampa completado o envío en menos de 3 segundos.
    if (honeypot !== "" || Date.now() - mountedAt.current < 3000) {
      setError("No pudimos procesar el envío. Intentá nuevamente.");
      return null;
    }
    const problem = validateSellWatch(form);
    if (problem) {
      setError(problem);
      return null;
    }
    setError(null);
    return buildSellWatchMessage(form);
  };

  const sendInstagram = () => {
    if (!instagramUsername) return;
    const message = prepare();
    if (!message) return;
    trackLead("vende-tu-reloj-instagram");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message).then(
        () =>
          toast.success("Copiamos los datos de tu reloj", {
            description: "Pegalos en el chat de Instagram que se abrió y sumá las fotos.",
            duration: 9000,
          }),
        () => undefined
      );
    }
    window.open(instagramDmUrl(instagramUsername), "_blank", "noopener,noreferrer");
  };

  const sendWhatsApp = () => {
    const message = prepare();
    if (!message) return;
    trackLead("vende-tu-reloj-whatsapp");
    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (instagramUsername) sendInstagram();
        else sendWhatsApp();
      }}
    >
      {/* Campo trampa: oculto para personas, visible para bots. */}
      <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
        <label>
          No completar este campo
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vender-nombre" className="text-base">
          Tu nombre
        </Label>
        <Input
          id="vender-nombre"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={100}
          autoComplete="name"
          required
          className="h-11 text-base md:text-base"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vender-marca" className="text-base">
            Marca
          </Label>
          <Input
            id="vender-marca"
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            maxLength={60}
            placeholder="Ej.: Omega"
            required
            className="h-11 text-base md:text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vender-modelo" className="text-base">
            Modelo
          </Label>
          <Input
            id="vender-modelo"
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            maxLength={80}
            placeholder="Ej.: Seamaster"
            required
            className="h-11 text-base md:text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vender-referencia" className="text-base">
            Referencia <span className="font-normal text-muted-foreground">(si la sabés)</span>
          </Label>
          <Input
            id="vender-referencia"
            value={form.reference}
            onChange={(e) => set("reference", e.target.value)}
            maxLength={40}
            className="h-11 text-base md:text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vender-anio" className="text-base">
            Año aproximado <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="vender-anio"
            value={form.year}
            onChange={(e) => set("year", e.target.value)}
            inputMode="numeric"
            maxLength={12}
            className="h-11 text-base md:text-base"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vender-estado" className="text-base">
          Estado
        </Label>
        <select
          id="vender-estado"
          value={form.condition}
          onChange={(e) => set("condition", e.target.value)}
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Elegí una opción</option>
          {SELL_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-base font-medium">¿Qué conservás?</legend>
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-base">
            <input
              type="checkbox"
              checked={form.hasBox}
              onChange={(e) => set("hasBox", e.target.checked)}
              className="h-5 w-5 accent-[var(--primary)]"
            />
            Caja original
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-base">
            <input
              type="checkbox"
              checked={form.hasPapers}
              onChange={(e) => set("hasPapers", e.target.checked)}
              className="h-5 w-5 accent-[var(--primary)]"
            />
            Papeles
          </label>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="vender-comentarios" className="text-base">
          Comentarios <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="vender-comentarios"
          value={form.comments}
          onChange={(e) => set("comments", e.target.value)}
          maxLength={600}
          rows={4}
          placeholder="Historia del reloj, último service, precio que tenés en mente…"
          className="text-base md:text-base"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-base text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {instagramUsername && (
          <button
            type="button"
            onClick={sendInstagram}
            className={`${BUTTON} bg-primary text-primary-foreground shadow hover:bg-primary/90`}
          >
            <Instagram className="h-5 w-5" aria-hidden="true" />
            Enviar por Instagram
          </button>
        )}
        {whatsappNumber && (
          <button
            type="button"
            onClick={sendWhatsApp}
            className={`${BUTTON} border border-input hover:bg-accent`}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            Enviar por WhatsApp
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Se abre el chat con los datos listos. Ahí mismo podés adjuntar las fotos del reloj.
      </p>
    </form>
  );
}
