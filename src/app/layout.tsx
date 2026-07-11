import type { Metadata, Viewport } from "next";
import {
  Inter,
  Geist,
  Playfair_Display,
  DM_Sans,
  Poppins,
  Plus_Jakarta_Sans,
  Merriweather,
  Lora,
} from "next/font/google";
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

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "arial"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-merriweather",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const customerPageFontVariables = cn(
  geist.variable,
  inter.variable,
  playfair.variable,
  dmSans.variable,
  poppins.variable,
  plusJakarta.variable,
  merriweather.variable,
  lora.variable
);

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
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={cn(inter.className, "font-sans", customerPageFontVariables)}>
      <body className={cn(inter.className, 'antialiased')}>
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
