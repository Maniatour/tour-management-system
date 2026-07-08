import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import AbortErrorHandler from "@/components/AbortErrorHandler";
import AppToaster from "@/components/AppToaster";
import LazySopComplianceGate from "@/components/layout/LazySopComplianceGate";
import DevServiceWorkerCleanup from "@/components/DevServiceWorkerCleanup";
import DevBootRecovery from "@/components/DevBootRecovery";
import { DevBootRecoveryInlineScript } from "@/components/DevBootRecoveryInlineScript";
import RouteTransitionProgress from "@/components/RouteTransitionProgress";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="ko" className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>
        <DevBootRecoveryInlineScript />
        <AbortErrorHandler />
        {process.env.NODE_ENV === "development" ? (
          <>
            <DevServiceWorkerCleanup />
            <DevBootRecovery />
          </>
        ) : null}
        <AuthProvider>
          <RouteTransitionProgress />
          <AppToaster />
          <LazySopComplianceGate />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
