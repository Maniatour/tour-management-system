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
  Righteous,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { OperatorProvider } from "@/contexts/OperatorContext";
import AbortErrorHandler from "@/components/AbortErrorHandler";
import SafePointerCaptureGuard from "@/components/SafePointerCaptureGuard";
import AppToaster from "@/components/AppToaster";
import LazySopComplianceGate from "@/components/layout/LazySopComplianceGate";
import DevServiceWorkerCleanup from "@/components/DevServiceWorkerCleanup";
import DevBootRecovery from "@/components/DevBootRecovery";
import { DevBootRecoveryInlineScript } from "@/components/DevBootRecoveryInlineScript";
import AuthSessionCookieInlineScript from "@/components/AuthSessionCookieInlineScript";
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

const righteous = Righteous({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-righteous",
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
  lora.variable,
  righteous.variable
);

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ),
  applicationName: "Kovegas",
  title: {
    default: "Kovegas | Las Vegas & Grand Canyon Tours",
    template: "%s | Kovegas",
  },
  description:
    "Grand Canyon, Antelope Canyon, Zion and more from Las Vegas. Small groups, hotel pickup, local guides. Book with Kovegas (Mania Tour).",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kovegas",
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
        <AuthSessionCookieInlineScript />
        <DevBootRecoveryInlineScript />
        <AbortErrorHandler />
        <SafePointerCaptureGuard />
        {process.env.NODE_ENV === "development" ? (
          <>
            <DevServiceWorkerCleanup />
            <DevBootRecovery />
          </>
        ) : null}
        <AuthProvider>
          <OperatorProvider>
            <RouteTransitionProgress />
            <AppToaster />
            <LazySopComplianceGate />
            {children}
          </OperatorProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
