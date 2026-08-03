"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Formulario de contacto con protección anti-spam:
 * - Campo honeypot invisible (los bots lo completan, los humanos no).
 * - Tiempo mínimo de completado (los bots envían instantáneamente).
 * El envío compone un mensaje de WhatsApp (sin backend de email).
 */
export function ContactForm({ whatsappNumber }: { whatsappNumber: string }) {
  const [name, setName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [honeypot, setHoneypot] = React.useState("");
  const mountedAt = React.useRef(Date.now());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Anti-spam: honeypot completado o envío en menos de 3 segundos.
    if (honeypot !== "" || Date.now() - mountedAt.current < 3000) {
      toast.error("No pudimos procesar el envío. Intente nuevamente.");
      return;
    }
    if (!name.trim() || !message.trim()) {
      toast.error("Complete su nombre y el mensaje.");
      return;
    }
    if (!whatsappNumber) {
      toast.error("El contacto por WhatsApp no está disponible en este momento.");
      return;
    }

    const text = `Hola, soy ${name.trim()}. ${message.trim()}`;
    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {/* Honeypot: oculto para humanos, visible para bots */}
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
        <Label htmlFor="contact-name">Nombre</Label>
        <Input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-message">Mensaje</Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={1000}
          rows={5}
          placeholder="Contanos qué reloj te interesa o qué necesitás…"
        />
      </div>
      <Button type="submit" className="w-full">
        Enviar por WhatsApp
      </Button>
    </form>
  );
}
