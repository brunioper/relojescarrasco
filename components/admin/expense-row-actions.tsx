"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { deleteGeneralExpenseAction } from "@/app/admin/gastos/actions";
import { Button } from "@/components/ui/button";
import { ExpenseDialog } from "@/components/admin/expense-dialog";
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
import type { CurrencyCode, PaymentStatus } from "@/types/supabase";

export function ExpenseRowActions({
  expense,
  categories,
  suppliers,
  activeRate,
  today,
}: {
  expense: {
    id: string;
    expense_date: string;
    category_id: string;
    description: string;
    amount: number;
    currency: CurrencyCode;
    exchange_rate: number;
    supplier_id: string | null;
    payment_method: string | null;
    due_date: string | null;
    is_recurring: boolean;
    payment_status: PaymentStatus;
  };
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  activeRate: number | null;
  today: string;
}) {
  const router = useRouter();

  const remove = async () => {
    const result = await deleteGeneralExpenseAction(expense.id);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Gasto eliminado.");
      router.refresh();
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <ExpenseDialog
        categories={categories}
        suppliers={suppliers}
        activeRate={activeRate}
        today={today}
        expense={expense}
        trigger={
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar gasto">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        }
      />
      {expense.payment_status === "pendiente" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              aria-label="Eliminar gasto"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
              <AlertDialogDescription>
                Se marca como eliminado y deja de aparecer en reportes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => void remove()}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
