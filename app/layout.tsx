import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "../components/ui/Toast";

export const metadata: Metadata = {
  title: "Fluxo",
  description: "Acompanhamento das ações de formação no SIGO",
  applicationName: "Fluxo",
  authors: [{ name: "TheStarter" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <head>
        <Script src="/tema.js" strategy="beforeInteractive" />
      </head>
      <body suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
