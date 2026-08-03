import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getPublicSettings } from "@/services/settings";
import { publicEnv } from "@/lib/env";
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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const siteUrl = settings.siteUrl || publicEnv.NEXT_PUBLIC_SITE_URL;

  return {
    metadataBase: new URL(siteUrl),
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
