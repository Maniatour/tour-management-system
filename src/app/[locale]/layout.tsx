import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import Navigation from "@/components/Navigation";
import Sidebar from "@/components/Sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "투어 관리 시스템",
  description: "가이드를 위한 투어 스케줄 및 고객 관리 시스템",
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages({ locale });
  
  // Admin 페이지인지 확인
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isAdminPage = pathname.includes('/admin');

  // Admin 페이지인 경우 기본 레이아웃만 제공
  if (isAdminPage) {
    return (
      <NextIntlClientProvider messages={messages} locale={locale}>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </AuthProvider>
      </NextIntlClientProvider>
    );
  }

  // 일반 페이지인 경우 기존 레이아웃 사용
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <div className="flex flex-col lg:flex-row">
            <Sidebar />
            <main className="flex-1 p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </AuthProvider>
          </NextIntlClientProvider>
  );
}
