"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Banknote,
  ClipboardList,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Watch,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/app/auth/actions";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/productos", label: "Productos", icon: Watch },
  { href: "/admin/inventario", label: "Inventario", icon: Package },
  { href: "/admin/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/admin/gastos", label: "Gastos", icon: Receipt },
  { href: "/admin/pagos", label: "Pagos", icon: Banknote },
  { href: "/admin/liquidez", label: "Caja y liquidez", icon: Wallet },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/admin/cotizaciones", label: "Cotizaciones", icon: Landmark },
  { href: "/admin/contactos", label: "Clientes y proveedores", icon: Users },
  { href: "/admin/auditoria", label: "Auditoría", icon: ClipboardList },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
] as const;

export function AdminShell({
  children,
  userName,
  userRole,
}: {
  children: React.ReactNode;
  userName: string;
  userRole: "admin" | "viewer";
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const navItems = (
    <nav className="flex flex-col gap-1 px-3" aria-label="Navegación del panel">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-foreground/10 text-sidebar-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar escritorio */}
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center gap-2 px-6">
          <Watch className="h-5 w-5 text-gold" strokeWidth={1.5} />
          <span className="font-serif">Relojes Carrasco</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">{navItems}</div>
        <div className="border-t border-sidebar-foreground/10 p-4 text-xs text-sidebar-foreground/50">
          Sesión: {userName} ({userRole === "admin" ? "Administrador" : "Consulta"})
        </div>
      </aside>

      {/* Menú móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar text-sidebar-foreground">
            <div className="flex h-16 items-center justify-between px-4">
              <span className="font-serif">Relojes Carrasco</span>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">{navItems}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden lg:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {userName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-40 truncate text-sm sm:block">{userName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {userName}
                <p className="text-xs font-normal text-muted-foreground">
                  {userRole === "admin" ? "Administrador" : "Solo consulta"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/" target="_blank">
                  Ver sitio público
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void logoutAction();
                }}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 bg-secondary/30 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
