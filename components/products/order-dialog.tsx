"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, ShoppingBag } from "lucide-react";
import { createOrderRequestAction } from "@/app/(public)/catalogo/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Checkout público: pedido de un reloj desde su ficha. No es un pago
 * real (no hay pasarela): guarda el pedido y avisa al admin; el pago
 * se coordina después por WhatsApp/Instagram/teléfono.
 *
 * Protección anti-spam igual a components/public/contact-form.tsx:
 * honeypot invisible + tiempo mínimo de completado.
 */
export function OrderDialog({
  productId,
  productName,
  pickupAddress,
}: {
  productId: string;
  productName: string;
  pickupAddress: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [deliveryMethod, setDeliveryMethod] = React.useState<"envio" | "retiro">("envio");
  const [honeypot, setHoneypot] = React.useState("");
  const mountedAt = React.useRef(Date.now());

  const reset = () => {
    setSubmitted(false);
    setDeliveryMethod("envio");
    setHoneypot("");
    mountedAt.current = Date.now();
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (honeypot !== "" || Date.now() - mountedAt.current < 3000) {
      toast.error("No pudimos procesar el pedido. Intente nuevamente.");
      return;
    }

    setSubmitting(true);
    const result = await createOrderRequestAction(
      {
        product_id: productId,
        first_name: fd.get("first_name"),
        last_name: fd.get("last_name"),
        phone: fd.get("phone"),
        instagram_username: fd.get("instagram_username") || null,
        delivery_method: deliveryMethod,
        shipping_address: deliveryMethod === "envio" ? fd.get("shipping_address") : null,
      },
      productName
    );
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSubmitted(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">
          <ShoppingBag className="h-5 w-5" />
          Hacer pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {submitted ? (
          <div className="py-4 text-center">
            <DialogTitle>¡Pedido recibido!</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Te contactaremos por WhatsApp o Instagram a la brevedad para coordinar el pago y la
              entrega.
            </p>
            <Button className="mt-4" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Pedido: {productName}</DialogTitle>
              <DialogDescription>
                Completá tus datos y te contactamos para coordinar el pago y la entrega.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="order-first-name">Nombre *</Label>
                <Input id="order-first-name" name="first_name" required maxLength={100} autoComplete="given-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order-last-name">Apellido *</Label>
                <Input id="order-last-name" name="last_name" required maxLength={100} autoComplete="family-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order-phone">Teléfono / WhatsApp *</Label>
                <Input
                  id="order-phone"
                  name="phone"
                  type="tel"
                  required
                  maxLength={30}
                  autoComplete="tel"
                  placeholder="099 123 456"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order-instagram">Usuario de Instagram</Label>
                <Input id="order-instagram" name="instagram_username" maxLength={60} placeholder="@usuario" />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Entrega *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={deliveryMethod === "envio" ? "default" : "outline"}
                    onClick={() => setDeliveryMethod("envio")}
                  >
                    Envío a domicilio
                  </Button>
                  <Button
                    type="button"
                    variant={deliveryMethod === "retiro" ? "default" : "outline"}
                    onClick={() => setDeliveryMethod("retiro")}
                  >
                    Retiro en el local
                  </Button>
                </div>
              </div>

              {deliveryMethod === "envio" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="order-address">Dirección de envío *</Label>
                  <Textarea id="order-address" name="shipping_address" required rows={2} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  {pickupAddress
                    ? `Retirás en: ${pickupAddress}`
                    : "Te confirmamos la dirección de retiro al contactarte."}
                </p>
              )}

              <div className="rounded-lg bg-secondary p-3 text-sm sm:col-span-2">
                <span className="font-medium">Método de pago: </span>
                <span className="text-muted-foreground">
                  Transferencia bancaria o efectivo — coordinamos el pago cuando te contactemos.
                </span>
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar pedido
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
