import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getPublicSettings } from "@/services/settings";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

// Color de la barra del navegador en el celular, igual al fondo del encabezado.
export const viewport: Viewport = {
  themeColor: "#fbfaf7",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();

  return {
    metadataBase: new URL(siteUrl(settings.siteUrl)),
    title: {
      default: settings.seoTitle || settings.businessName,
      template: `%s — ${settings.businessName}`,
    },
    description: settings.seoDescription,
    openGraph: {
      type: "website",
      locale: "es_UY",
      siteName: settings.businessName,
    },
    twitter: {
      card: "summary_large_image",
    },
    // Los despliegues de prueba (Preview) no deben indexarse.
    ...(process.env.VERCEL_ENV === "preview" ? { robots: { index: false, follow: false } } : {}),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-UY" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
