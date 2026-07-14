import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#177b5f",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return {
    metadataBase: host ? new URL(`${protocol}://${host}`) : undefined,
    title: "Compra Ligera · Lista de compras",
    description: "Una lista de compras simple, amable y persistente.",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Compra Ligera",
    },
    icons: {
      apple: [{ sizes: "180x180", url: "/apple-icon" }],
      icon: [{ type: "image/svg+xml", url: "/favicon.svg" }],
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      title: "Compra Ligera",
      description: "Hagamos que comprar sea más liviano.",
      images: [{ url: "/og.png", width: 1731, height: 909, alt: "Compra Ligera" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Compra Ligera",
      description: "Hagamos que comprar sea más liviano.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
