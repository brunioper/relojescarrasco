"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Copy, Eye, EyeOff, MoreHorizontal, Trash2, Undo2 } from "lucide-react";
import {
  archiveProductAction,
  cancelSaleAction,
  changeStatusAction,
  duplicateProductAction,
  setPublishedAction,
  softDeleteProductAction,
} from "@/app/admin/productos/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProductStatus } from "@/types/supabase";

export function ProductActions({
  productId,
  status,
  isPublished,
  activeSaleId,
}: {
  productId: string;
  status: ProductStatus;
  isPublished: boolean;
  activeSaleId: string | null;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmCancelSale, setConfirmCancelSale] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    const result = await fn();
    if (!result.ok) toast.error(result.error ?? "Error");
    else {
      toast.success(success);
      router.refresh();
    }
  };

  const setStatus = (newStatus: ProductStatus, label: string) =>
    run(() => changeStatusAction(productId, newStatus), label);

  return (
    <>
      <div className="flex items-center gap-2">
        {status !== "vendido" && status !== "archivado" && (
          <Button
            variant="outline"
            onClick={() =>
              run(
                () => setPublishedAction(productId, !isPublished),
                isPublished ? "Producto despublicado." : "Producto publicado en el catálogo."
              )
            }
          >
            {isPublished ? (
              <>
                <EyeOff className="h-4 w-4" /> Despublicar
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Publicar
              </>
            )}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Más acciones">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
            {status !== "vendido" && (
              <>
                {status !== "disponible" && (
                  <DropdownMenuItem onSelect={() => void setStatus("disponible", "Marcado como disponible.")}>
                    Disponible
                  </DropdownMenuItem>
                )}
                {status !== "reservado" && (
                  <DropdownMenuItem onSelect={() => void setStatus("reservado", "Marcado como reservado.")}>
                    Reservado
                  </DropdownMenuItem>
                )}
                {status !== "en_reparacion" && (
                  <DropdownMenuItem
                    onSelect={() => void setStatus("en_reparacion", "Marcado en reparación.")}
                  >
                    En reparación
                  </DropdownMenuItem>
                )}
                {status !== "no_publicado" && (
                  <DropdownMenuItem
                    onSelect={() => void setStatus("no_publicado", "Marcado como no publicado.")}
                  >
                    No publicado
                  </DropdownMenuItem>
                )}
              </>
            )}
            {status === "vendido" && activeSaleId && (
              <DropdownMenuItem onSelect={() => setConfirmCancelSale(true)}>
                <Undo2 className="h-4 w-4" /> Cancelar venta
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                void run(async () => {
                  const result = await duplicateProductAction(productId);
                  if (result.ok && result.data) {
                    router.push(`/admin/productos/${result.data.id}`);
                  }
                  return result;
                }, "Producto duplicado.")
              }
            >
              <Copy className="h-4 w-4" /> Duplicar
            </DropdownMenuItem>
            {status !== "vendido" && status !== "archivado" && (
              <DropdownMenuItem
                onSelect={() => void run(() => archiveProductAction(productId), "Producto archivado.")}
              >
                <Archive className="h-4 w-4" /> Archivar
              </DropdownMenuItem>
            )}
            {status !== "vendido" && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este producto?</AlertDialogTitle>
            <AlertDialogDescription>
              El producto se marca como eliminado y desaparece de los listados (baja lógica). Los
              productos vendidos no pueden eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void run(async () => {
                  const result = await softDeleteProductAction(productId);
                  if (result.ok) router.push("/admin/productos");
                  return result;
                }, "Producto eliminado.")
              }
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancelSale} onOpenChange={setConfirmCancelSale}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar la venta?</AlertDialogTitle>
            <AlertDialogDescription>
              La venta se marca como cancelada y el reloj vuelve a estado disponible (sin
              publicar). Indique el motivo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motivo de la cancelación…"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void run(
                  () => cancelSaleAction(activeSaleId, cancelReason),
                  "Venta cancelada."
                )
              }
            >
              Cancelar venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
