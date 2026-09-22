import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluxo",
  description: "Gestão de fluxos formativos",
  applicationName: "Fluxo",
  authors: [{ name: "The Starter" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
