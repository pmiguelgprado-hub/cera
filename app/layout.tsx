import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CERA · Pasaporte de predesarrollo",
  description:
    "Herramienta territorial para evaluar comunidades energéticas rurales en Asturias.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
