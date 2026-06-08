import type { Metadata } from "next";
import { Poppins, PT_Sans } from "next/font/google";
import "./globals.css";
// build: 2026-05-16-v5
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase";
import { ServiceWorkerCleanup } from "@/components/sw-cleanup";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pt-sans",
});

export const metadata: Metadata = {
  title: "ContractTime - Freeway Escuela de Manejo",
  description: "Gestión inteligente de contratos y servicios viales",
  icons: {
    icon: "/logo.png",
    apple: "/icon-192.png",
    shortcut: "/logo.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ContractTime",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileImage": "/icon-192.png",
    "msapplication-TileColor": "#1d4ed8",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${ptSans.variable} font-body antialiased bg-background text-foreground`}
      >
        <ServiceWorkerCleanup />
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
