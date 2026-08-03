import { requireAdminPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/formatting/date";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Auditoría" };
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  crear: "Creación",
  modificar: "Modificación",
  eliminar: "Eliminación",
  vender: "Venta",
  cancelar_venta: "Cancelación de venta",
  publicar: "Publicación",
  despublicar: "Despublicación",
  eliminar_logico: "Baja lógica",
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
  login_fallido: "Login fallido",
  password_actualizada: "Cambio de contraseña",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entidad?: string; pagina?: string }>;
}) {
  // Solo administradores pueden ver la auditoría.
  await requireAdminPage();
  const params = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, Number(params.pagina ?? 1) || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("audit_logs")
    .select("id, user_id, action, entity_type, entity_id, created_at, ip_address", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (params.entidad) query = query.eq("entity_type", params.entidad);

  const [{ data: logs, count }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name"),
  ]);

  const userName = (id: string | null) =>
    id ? (profiles?.find((p) => p.id === id)?.full_name ?? "Usuario") : "Sistema";
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / pageSize));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Registro inmutable de operaciones sensibles. No puede editarse desde la interfaz.
        </p>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(logs ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Sin registros de auditoría.
                </TableCell>
              </TableRow>
            )}
            {(logs ?? []).map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm tabular-nums">{formatDateTime(log.created_at)}</TableCell>
                <TableCell className="text-sm">{userName(log.user_id)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      log.action === "eliminar" || log.action === "login_fallido"
                        ? "destructive"
                        : log.action === "crear" || log.action === "vender"
                          ? "success"
                          : "secondary"
                    }
                  >
                    {ACTION_LABEL[log.action] ?? log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{log.entity_type}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.ip_address ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-3 border-t p-3 text-sm">
            {page > 1 && (
              <a href={`/admin/auditoria?pagina=${page - 1}`} className="hover:underline">
                ← Anterior
              </a>
            )}
            <span className="text-muted-foreground">
              Página {page} de {pageCount}
            </span>
            {page < pageCount && (
              <a href={`/admin/auditoria?pagina=${page + 1}`} className="hover:underline">
                Siguiente →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
