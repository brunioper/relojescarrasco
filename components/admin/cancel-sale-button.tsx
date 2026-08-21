"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { cancelSaleAction } from "@/app/admin/productos/actions";
import { Button } from "@/components/ui/button";
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

/** Cancela una venta puntual (usado en la tabla de ventas de stock de accesorios). */
export function CancelSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Undo2 className="h-3.5 w-3.5" /> Cancelar
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Las unidades vendidas vuelven al stock. Indique el motivo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo de la cancelación…"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const result = await cancelSaleAction(saleId, reason);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Venta cancelada. Stock actualizado.");
                setOpen(false);
                router.refresh();
              }}
            >
              Cancelar venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
