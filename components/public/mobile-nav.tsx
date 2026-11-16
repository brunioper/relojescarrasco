"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Instagram, Menu, MessageCircle, X } from "lucide-react";
import { instagramDmUrl } from "@/lib/inquiry";

export function MobileNav({
  links,
  whatsappNumber,
  instagramUsername,
  businessName,
}: {
  links: { href: string; label: string }[];
  whatsappNumber: string;
  instagramUsername: string | null;
  businessName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls="menu-movil"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {open && (
        <div
          id="menu-movil"
          className="fixed inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b bg-background shadow-lg"
        >
          <nav className="flex flex-col p-4" aria-label={`Menú de ${businessName}`}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="rounded-md px-3 py-3.5 text-lg hover:bg-accent aria-[current=page]:font-medium"
              >
                {link.label}
              </Link>
            ))}
            {instagramUsername && (
              <a
                href={instagramDmUrl(instagramUsername)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-3 text-base text-primary-foreground"
              >
                <Instagram className="h-5 w-5" aria-hidden="true" /> Escribinos por Instagram
              </a>
            )}
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-input px-3 text-base"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" /> WhatsApp
              </a>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
