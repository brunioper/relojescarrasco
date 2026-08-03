"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteCustomerAction,
  deleteSupplierAction,
  saveCustomerAction,
  saveSupplierAction,
} from "@/app/admin/contactos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  document_id: string | null;
  notes: string | null;
};

type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export function CustomerDialog({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await saveCustomerAction(customer?.id ?? null, {
      full_name: fd.get("full_name"),
      phone: fd.get("phone") || null,
      email: fd.get("email") || "",
      document_id: fd.get("document_id") || null,
      notes: fd.get("notes") || null,
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(customer ? "Cliente actualizado." : "Cliente creado.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {customer ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar cliente">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cust-name">Nombre completo *</Label>
            <Input id="cust-name" name="full_name" required minLength={2} defaultValue={customer?.full_name ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-phone">Teléfono</Label>
            <Input id="cust-phone" name="phone" defaultValue={customer?.phone ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-email">Email</Label>
            <Input id="cust-email" name="email" type="email" defaultValue={customer?.email ?? ""} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cust-doc">Documento (opcional)</Label>
            <Input id="cust-doc" name="document_id" defaultValue={customer?.document_id ?? ""} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cust-notes">Notas</Label>
            <Textarea id="cust-notes" name="notes" rows={2} defaultValue={customer?.notes ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SupplierDialog({ supplier }: { supplier?: Supplier }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await saveSupplierAction(supplier?.id ?? null, {
      name: fd.get("name"),
      contact_name: fd.get("contact_name") || null,
      phone: fd.get("phone") || null,
      email: fd.get("email") || "",
      notes: fd.get("notes") || null,
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(supplier ? "Proveedor actualizado." : "Proveedor creado.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {supplier ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar proveedor">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" /> Nuevo proveedor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sup-name">Nombre *</Label>
            <Input id="sup-name" name="name" required minLength={2} defaultValue={supplier?.name ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-contact">Contacto</Label>
            <Input id="sup-contact" name="contact_name" defaultValue={supplier?.contact_name ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-phone">Teléfono</Label>
            <Input id="sup-phone" name="phone" defaultValue={supplier?.phone ?? ""} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sup-email">Email</Label>
            <Input id="sup-email" name="email" type="email" defaultValue={supplier?.email ?? ""} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sup-notes">Notas</Label>
            <Textarea id="sup-notes" name="notes" rows={2} defaultValue={supplier?.notes ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteContactButton({
  id,
  kind,
  name,
}: {
  id: string;
  kind: "cliente" | "proveedor";
  name: string;
}) {
  const router = useRouter();

  const remove = async () => {
    const result =
      kind === "cliente" ? await deleteCustomerAction(id) : await deleteSupplierAction(id);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(`${kind === "cliente" ? "Cliente" : "Proveedor"} eliminado.`);
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
          aria-label={`Eliminar ${kind}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar a {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se oculta de los listados (baja lógica). Las operaciones históricas asociadas se
            conservan.
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
