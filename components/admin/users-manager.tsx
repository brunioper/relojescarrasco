"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateUserRoleAction } from "@/app/admin/configuracion/actions";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserRole } from "@/types/supabase";

type UserRow = {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
};

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();

  const update = async (user: UserRow, changes: Partial<Pick<UserRow, "role" | "is_active">>) => {
    const result = await updateUserRoleAction({
      user_id: user.id,
      role: changes.role ?? user.role,
      is_active: changes.is_active ?? user.is_active,
    });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Usuario actualizado.");
      router.refresh();
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usuario</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Cuenta activa</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <TableRow key={user.id}>
              <TableCell>
                {user.full_name || "(sin nombre)"}
                {isSelf && (
                  <Badge variant="info" className="ml-2">
                    Vos
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {isSelf ? (
                  <Badge variant="secondary">
                    {user.role === "admin" ? "Administrador" : "Consulta"}
                  </Badge>
                ) : (
                  <Select
                    value={user.role}
                    onValueChange={(v) => void update(user, { role: v as UserRole })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="viewer">Consulta</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell>
                <Switch
                  checked={user.is_active}
                  disabled={isSelf}
                  aria-label={`Cuenta de ${user.full_name} activa`}
                  onCheckedChange={(checked) => void update(user, { is_active: checked })}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
