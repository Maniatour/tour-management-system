import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import AbortErrorHandler from "@/components/AbortErrorHandler";
import AppToaster from "@/components/AppToaster";
import SopComplianceGate from "@/components/sop/SopComplianceGate";
import DevServiceWorkerCleanup from "@/components/DevServiceWorkerCleanup";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  applicationName: "MANIATOUR",
  title: "MANIATOUR",
  description: "Tour schedule and customer management system for guides",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MANIATOUR",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <AbortErrorHandler />
        <DevServiceWorkerCleanup />
        <AuthProvider>
          <AppToaster />
          <SopComplianceGate />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
