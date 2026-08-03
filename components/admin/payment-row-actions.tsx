"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deletePaymentAction } from "@/app/admin/pagos/actions";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function PaymentRowActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();

  const remove = async () => {
    const result = await deletePaymentAction(paymentId);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Pago eliminado; el saldo del comprobante se recalculó.");
      router.refresh();
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          aria-label="Eliminar pago"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este pago?</AlertDialogTitle>
          <AlertDialogDescription>
            Use esta opción solo para corregir un pago mal ingresado. El movimiento de caja
            asociado también se elimina y el saldo del comprobante se recalcula.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => void remove()}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
