"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Instagram, Loader2, Star, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteProductImageAction,
  importInstagramImagesAction,
  registerProductImageAction,
  reorderImagesAction,
  setCoverImageAction,
} from "@/app/admin/productos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { productImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

const MAX_FILE_MB = 10;
const MAX_DIMENSION = 2000;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type ProductImage = {
  id: string;
  storage_path: string;
  is_cover: boolean;
  sort_order: number;
};

/**
 * Comprime la imagen en el navegador antes de subirla:
 * redimensiona a máx. 2000px y convierte a WebP (calidad 0,85).
 */
async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas no disponible");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85)
  );
  if (!blob) throw new Error("No se pudo convertir la imagen");
  return { blob, width, height };
}

export function ImageManager({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [instagramUrl, setInstagramUrl] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const importFromInstagram = async () => {
    if (!instagramUrl.trim()) {
      toast.error("Pegá el enlace del post de Instagram.");
      return;
    }
    setImporting(true);
    const result = await importInstagramImagesAction(productId, instagramUrl.trim());
    setImporting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { imported, failed } = result.data;
    toast.success(
      `${imported} ${imported === 1 ? "foto importada" : "fotos importadas"} de Instagram.` +
        (failed > 0 ? ` ${failed} no se pudieron descargar.` : "")
    );
    setInstagramUrl("");
    router.refresh();
  };

  const sorted = [...images].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order
  );

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);

    const supabase = createClient();
    let uploaded = 0;

    for (const file of list) {
      try {
        if (!ACCEPTED.includes(file.type)) {
          toast.error(`${file.name}: formato no soportado (use JPG, PNG o WebP).`);
          continue;
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          toast.error(`${file.name}: supera el máximo de ${MAX_FILE_MB} MB.`);
          continue;
        }

        const { blob, width, height } = await compressImage(file);
        // Nombre de archivo ALEATORIO: nunca se usa el nombre original.
        const path = `products/${productId}/${crypto.randomUUID()}.webp`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, blob, { contentType: "image/webp", upsert: false });

        if (uploadError) {
          toast.error(`${file.name}: no se pudo subir.`);
          continue;
        }

        const result = await registerProductImageAction({
          product_id: productId,
          storage_path: path,
          width,
          height,
          size_bytes: blob.size,
        });

        if (!result.ok) {
          await supabase.storage.from("product-images").remove([path]);
          toast.error(result.error);
          continue;
        }
        uploaded++;
      } catch {
        toast.error(`${file.name}: error procesando la imagen.`);
      }
    }

    setUploading(false);
    if (uploaded > 0) {
      toast.success(`${uploaded} ${uploaded === 1 ? "imagen subida" : "imágenes subidas"}.`);
      router.refresh();
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const order = sorted.map((i) => i.id);
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    const result = await reorderImagesAction(productId, order);
    if (!result.ok) toast.error(result.error);
    else router.refresh();
  };

  const setCover = async (imageId: string) => {
    const result = await setCoverImageAction(imageId);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Imagen de portada actualizada.");
      router.refresh();
    }
  };

  const remove = async (imageId: string) => {
    const result = await deleteProductImageAction(imageId);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Imagen eliminada.");
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Zona de subida drag & drop + móvil */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragOver ? "border-gold bg-accent" : "border-border"
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Comprimiendo y subiendo…</p>
          </>
        ) : (
          <>
            <ImagePlus className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm">
              Arrastrá las fotos aquí o{" "}
              <button
                type="button"
                className="font-medium text-gold underline-offset-2 hover:underline"
                onClick={() => inputRef.current?.click()}
              >
                seleccionalas
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG o WebP · máx. {MAX_FILE_MB} MB · se convierten a WebP automáticamente
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Importar desde Instagram */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Instagram className="h-4 w-4 text-muted-foreground" />
          Importar fotos desde Instagram
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pegá el enlace de un post público (ej. instagram.com/p/…) y traemos las fotos del reloj.
          En carruseles, Instagram a veces solo entrega la primera foto.
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void importFromInstagram();
          }}
        >
          <Input
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/ABC123…"
            aria-label="Enlace del post de Instagram"
            disabled={importing}
          />
          <Button type="submit" disabled={importing || !instagramUrl.trim()}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
            Importar
          </Button>
        </form>
      </div>

      {/* Grilla de imágenes */}
      {sorted.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="list">
          {sorted.map((image, index) => {
            const url = productImageUrl(image.storage_path)!;
            return (
              <li key={image.id} className="group relative overflow-hidden rounded-xl border bg-muted">
                <div className="relative aspect-square">
                  <Image src={url} alt="" fill sizes="200px" className="object-cover" />
                </div>
                {image.is_cover && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-gold px-2 py-0.5 text-xs font-medium text-white">
                    <Star className="h-3 w-3 fill-current" /> Portada
                  </span>
                )}
                <div className="flex items-center justify-between gap-1 border-t bg-card p-1.5">
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => void move(index, -1)}
                      disabled={index === 0}
                      aria-label="Mover antes"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => void move(index, 1)}
                      disabled={index === sorted.length - 1}
                      aria-label="Mover después"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    {!image.is_cover && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void setCover(image.id)}
                        aria-label="Definir como portada"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        aria-label="Eliminar imagen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta imagen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          La imagen se elimina del producto y del almacenamiento. Esta acción no se
                          puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void remove(image.id)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
