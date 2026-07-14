import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f6f8f2",
    description: "Una lista de compras simple, amable y persistente.",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "512x512",
        src: "/icon",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icon",
        type: "image/png",
      },
      {
        sizes: "180x180",
        src: "/apple-icon",
        type: "image/png",
      },
    ],
    lang: "es-AR",
    name: "Compra Ligera · Lista de compras",
    short_name: "Compra Ligera",
    start_url: "/",
    theme_color: "#177b5f",
  };
}
