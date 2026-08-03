import { requireStaffPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CustomerDialog,
  DeleteContactButton,
  SupplierDialog,
} from "@/components/admin/contact-dialogs";

export const metadata = { title: "Clientes y proveedores" };
export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const ctx = await requireStaffPage();
  const supabase = await createClient();
  const isAdmin = ctx.profile.role === "admin";

  const [{ data: customers }, { data: suppliers }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, phone, email, document_id, notes")
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("suppliers")
      .select("id, name, contact_name, phone, email, notes")
      .is("deleted_at", null)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Clientes y proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Información privada: nunca se expone en el sitio público.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Clientes ({(customers ?? []).length})</CardTitle>
          {isAdmin && <CustomerDialog />}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Notas</TableHead>
                {isAdmin && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(customers ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Sin clientes registrados.
                  </TableCell>
                </TableRow>
              )}
              {(customers ?? []).map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.full_name}</TableCell>
                  <TableCell className="text-sm">{customer.phone ?? "—"}</TableCell>
                  <TableCell className="text-sm">{customer.email ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.notes ?? "—"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-0.5">
                        <CustomerDialog customer={customer} />
                        <DeleteContactButton
                          id={customer.id}
                          kind="cliente"
                          name={customer.full_name}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Proveedores ({(suppliers ?? []).length})</CardTitle>
          {isAdmin && <SupplierDialog />}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Notas</TableHead>
                {isAdmin && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(suppliers ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Sin proveedores registrados.
                  </TableCell>
                </TableRow>
              )}
              {(suppliers ?? []).map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-sm">{supplier.contact_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{supplier.phone ?? "—"}</TableCell>
                  <TableCell className="text-sm">{supplier.email ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {supplier.notes ?? "—"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-0.5">
                        <SupplierDialog supplier={supplier} />
                        <DeleteContactButton id={supplier.id} kind="proveedor" name={supplier.name} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
