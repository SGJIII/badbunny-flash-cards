import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "Palabras de DTMF — Spanish flashcards from the album",
  description: "Practice 1,482 unique words from Bad Bunny’s DeBÍ TiRAR MáS FOToS with English meanings, verb conjugation notes, Puerto Rican slang, and local progress tracking.",
  applicationName: "Palabras de DTMF",
  icons: { icon: "/favicon.svg" },
  keywords: ["Bad Bunny", "DTMF", "Spanish flashcards", "Puerto Rican Spanish", "language learning"],
  openGraph: {
    type: "website",
    locale: "es_PR",
    title: "Palabras de DTMF",
    description: "1,482 palabras. Un álbum. Aprende español escuchando.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Palabras de DTMF vocabulary flashcards" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Palabras de DTMF",
    description: "1,482 palabras. Un álbum.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f3ebdd",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
