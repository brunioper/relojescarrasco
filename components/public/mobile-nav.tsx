"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNav({
  links,
  whatsappNumber,
  businessName,
}: {
  links: { href: string; label: string }[];
  whatsappNumber: string;
  businessName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="fixed inset-x-0 top-16 z-50 border-b bg-background shadow-lg">
          <nav className="flex flex-col p-4" aria-label={`Menú móvil de ${businessName}`}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-base hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-3 text-primary-foreground"
              >
                <MessageCircle className="h-5 w-5" /> Escribinos por WhatsApp
              </a>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
