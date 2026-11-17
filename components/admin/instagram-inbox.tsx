"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, ImageOff, Loader2 } from "lucide-react";
import {
  addPhotosToProductAction,
  createFromImportAction,
  discardImportAction,
  publishImportProductAction,
} from "@/app/admin/instagram/actions";
import type { InstagramImport, InstagramImportStatus, Json } from "@/types/supabase";
import { productImageUrl } from "@/lib/storage";
import { formatDateTime } from "@/lib/formatting/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type InboxProduct = {
  id: string;
  name: string;
  brand: string;
  model: string;
  status: string;
  is_published: boolean;
  listing_price_usd: number | null;
  cover_path: string | null;
};

const STATUS: Record<InstagramImportStatus, { label: string; variant: "success" | "warning" | "info" | "secondary" | "destructive" }> = {
  procesando: { label: "Procesando", variant: "info" },
  publicado: { label: "Publicado", variant: "success" },
  borrador: { label: "Falta el precio", variant: "warning" },
  pendiente: { label: "Para aprobar", variant: "warning" },
  descartado: { label: "Descartado", variant: "secondary" },
  aprobado: { label: "Resuelto", variant: "success" },
  sin_ia: { label: "Esperando la IA", variant: "info" },
  error: { label: "Error", variant: "destructive" },
};

const TO_REVIEW: InstagramImportStatus[] = ["pendiente", "borrador", "error", "sin_ia", "procesando"];

type Listing = {
  product_type?: string;
  brand?: string | null;
  model?: string | null;
  reference_number?: string | null;
  title?: string;
  visible_price?: { amount: number; currency: string } | null;
};

function readListing(json: Json | null): Listing {
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Listing) : {};
}

function useRun() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const run = async (key: string, action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setPending(key);
    const result = await action();
    setPending(null);
    if (!result.ok) {
      toast.error(result.error ?? "No se pudo completar.");
      return false;
    }
    toast.success(success);
    router.refresh();
    return true;
  };
  return { pending, run };
}

export function InstagramInbox({
  items,
  products,
  isAdmin,
}: {
  items: InstagramImport[];
  products: InboxProduct[];
  isAdmin: boolean;
}) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const toReview = items.filter((item) => TO_REVIEW.includes(item.status));
  const history = items.filter((item) => !TO_REVIEW.includes(item.status));

  return (
    <div className="space-y-8">
      <section aria-labelledby="ig-revisar" className="space-y-3">
        <h2 id="ig-revisar" className="text-base font-semibold">
          Para revisar {toReview.length > 0 && <span className="text-muted-foreground">({toReview.length})</span>}
        </h2>
        {toReview.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
            No hay nada esperando. Lo nuevo de Instagram aparece acá si necesita tu decisión.
          </p>
        ) : (
          toReview.map((item) => <ImportCard key={item.id} item={item} products={byId} isAdmin={isAdmin} />)
        )}
      </section>

      {history.length > 0 && (
        <section aria-labelledby="ig-historial" className="space-y-3">
          <h2 id="ig-historial" className="text-base font-semibold">
            Historial
          </h2>
          {history.map((item) => (
            <ImportCard key={item.id} item={item} products={byId} isAdmin={isAdmin} />
          ))}
        </section>
      )}
    </div>
  );
}

function ImportCard({
  item,
  products,
  isAdmin,
}: {
  item: InstagramImport;
  products: Map<string, InboxProduct>;
  isAdmin: boolean;
}) {
  const listing = readListing(item.ai_result);
  const status = STATUS[item.status];
  const product = item.product_id ? products.get(item.product_id) : undefined;
  const matches = item.matched_product_ids
    .map((id) => products.get(id))
    .filter((p): p is InboxProduct => p !== undefined);
  const { pending, run } = useRun();
  const [creating, setCreating] = React.useState(false);

  const detected = [
    listing.brand,
    listing.model,
    listing.reference_number ? `Ref. ${listing.reference_number}` : null,
    listing.visible_price ? `${listing.visible_price.currency} ${listing.visible_price.amount.toLocaleString("es-UY")}` : null,
  ].filter(Boolean);

  const canCreate =
    isAdmin && !item.product_id && ["pendiente", "descartado", "error", "sin_ia"].includes(item.status);

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:p-5">
      <Thumbnails paths={item.image_paths} />

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-muted-foreground">
            {item.source === "historia" ? "Historia" : "Publicación"} · {formatDateTime(item.posted_at)}
          </span>
          {item.permalink && (
            <a
              href={item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver en Instagram <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>

        {(listing.title || detected.length > 0) && (
          <div>
            {listing.title && <p className="font-medium">{listing.title}</p>}
            {detected.length > 0 && <p className="text-sm text-muted-foreground">{detected.join(" · ")}</p>}
          </div>
        )}
        {item.reason && <p className="text-sm">{item.reason}</p>}

        {product && (
          <p className="text-sm">
            Producto:{" "}
            <Link href={`/admin/productos/${product.id}`} className="font-medium underline underline-offset-4">
              {product.name}
            </Link>
            {product.is_published ? " · publicado" : " · sin publicar"}
          </p>
        )}

        {isAdmin && item.status === "pendiente" && matches.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">¿Es alguno de estos?</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {matches.map((match) => (
                <li key={match.id} className="flex items-center gap-3 rounded-lg border p-2">
                  <Thumb path={match.cover_path} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/productos/${match.id}`}
                      className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {match.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {match.is_published ? "Publicado" : "Sin publicar"}
                      {match.listing_price_usd !== null ? ` · US$ ${match.listing_price_usd.toLocaleString("es-UY")}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending !== null}
                    onClick={() =>
                      void run(
                        `fotos-${match.id}`,
                        () => addPhotosToProductAction(item.id, match.id),
                        "Fotos agregadas al producto."
                      )
                    }
                  >
                    {pending === `fotos-${match.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Es este: agregar fotos
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isAdmin && item.status === "borrador" && product && !product.is_published && (
          <PublishForm importId={item.id} suggested={listing.visible_price?.currency === "USD" ? listing.visible_price.amount : null} />
        )}

        {creating && (
          <CreateForm item={item} listing={listing} onDone={() => setCreating(false)} />
        )}

        {isAdmin && !creating && (canCreate || item.status === "pendiente") && (
          <div className="flex flex-wrap gap-2">
            {canCreate && (
              <Button size="sm" variant={matches.length > 0 ? "outline" : "default"} onClick={() => setCreating(true)}>
                {matches.length > 0 ? "Es otro: crear producto" : "Revisar y crear producto"}
              </Button>
            )}
            {item.status !== "descartado" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending !== null}
                onClick={() => void run("descartar", () => discardImportAction(item.id), "Descartado.")}
              >
                Descartar
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Thumbnails({ paths }: { paths: string[] }) {
  if (paths.length === 0) {
    return (
      <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ImageOff className="h-6 w-6" aria-label="Sin imagen" />
      </div>
    );
  }
  return (
    <div className="flex shrink-0 gap-2">
      <Thumb path={paths[0]!} size="lg" />
      {paths.length > 1 && (
        <div className="flex flex-col gap-2">
          {paths.slice(1, 3).map((path) => (
            <Thumb key={path} path={path} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ path, size }: { path: string | null; size: "sm" | "lg" }) {
  const url = path ? productImageUrl(path) : null;
  const box = size === "lg" ? "h-28 w-28" : "h-[3.25rem] w-[3.25rem]";
  if (!url) return <div className={`${box} shrink-0 rounded-md bg-muted`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- miniatura del panel, ya liviana
    <img src={url} alt="" className={`${box} shrink-0 rounded-md bg-muted object-cover`} loading="lazy" />
  );
}

function PublishForm({ importId, suggested }: { importId: string; suggested: number | null }) {
  const { pending, run } = useRun();
  const [price, setPrice] = React.useState(suggested ? String(suggested) : "");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void run("publicar", () => publishImportProductAction(importId, price), "Publicado en el catálogo.");
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`precio-${importId}`}>Precio en dólares</Label>
        <Input
          id={`precio-${importId}`}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="1200"
          className="w-36"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending !== null || price.trim() === ""}>
        {pending === "publicar" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Publicar
      </Button>
    </form>
  );
}

function CreateForm({ item, listing, onDone }: { item: InstagramImport; listing: Listing; onDone: () => void }) {
  const { pending, run } = useRun();
  const [values, setValues] = React.useState({
    category: listing.product_type === "correa" || listing.product_type === "accesorio" ? "accesorio" : "reloj",
    name: listing.title ?? [listing.brand, listing.model].filter(Boolean).join(" "),
    brand: listing.brand ?? "",
    model: listing.model ?? "",
    reference_number: listing.reference_number ?? "",
    price_usd:
      listing.visible_price?.currency === "USD" ? String(listing.visible_price.amount) : "",
  });
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: event.target.value }));
  const id = (field: string) => `${field}-${item.id}`;

  return (
    <form
      className="space-y-3 rounded-lg border bg-background p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const done = await run(
          "crear",
          () => createFromImportAction(item.id, values),
          values.price_usd ? "Producto creado y publicado." : "Producto creado sin publicar."
        );
        if (done) onDone();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={id("tipo")}>Tipo</Label>
          <select
            id={id("tipo")}
            value={values.category}
            onChange={set("category")}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="reloj">Reloj</option>
            <option value="accesorio">Correa o accesorio</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("nombre")}>Nombre *</Label>
          <Input id={id("nombre")} value={values.name} onChange={set("name")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("marca")}>Marca *</Label>
          <Input id={id("marca")} value={values.brand} onChange={set("brand")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("modelo")}>Modelo</Label>
          <Input id={id("modelo")} value={values.model} onChange={set("model")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("referencia")}>Referencia</Label>
          <Input id={id("referencia")} value={values.reference_number} onChange={set("reference_number")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("precio")}>Precio en dólares (opcional)</Label>
          <Input
            id={id("precio")}
            inputMode="decimal"
            value={values.price_usd}
            onChange={set("price_usd")}
            placeholder="Sin precio queda sin publicar"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending !== null}>
          {pending === "crear" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {values.price_usd ? "Crear y publicar" : "Crear sin publicar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
