import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import AbortErrorHandler from "@/components/AbortErrorHandler";
import AppToaster from "@/components/AppToaster";
import SopComplianceGate from "@/components/sop/SopComplianceGate";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap', // 폰트 로딩 최적화
  preload: true,
});

export const metadata: Metadata = {
  title: "MANIATOUR",
  description: "Tour schedule and customer management system for guides",
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Script
          id="abort-error-handler"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  function isAbort(r) {
    if (r == null) return false;
    if (typeof r === 'string') return r.toLowerCase().indexOf('aborted') !== -1;
    var msg = (r && (r.message || r.msg)) ? String(r.message || r.msg) : '';
    var name = (r && r.name) ? String(r.name) : '';
    return name === 'AbortError' || msg.indexOf('aborted') !== -1 || msg.indexOf('signal is aborted') !== -1;
  }
  window.addEventListener('unhandledrejection', function(e) {
    if (isAbort(e.reason)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('error', function(e) {
    var msg = (e.message || (e.error && e.error.message)) || '';
    if (msg.indexOf('aborted') !== -1 || msg.indexOf('AbortError') !== -1 || (e.error && e.error.name === 'AbortError')) {
      e.preventDefault();
      return true;
    }
    return false;
  }, true);
})();
            `.trim(),
          }}
        />
        <AbortErrorHandler />
        <AuthProvider>
          <AppToaster />
          <SopComplianceGate />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
