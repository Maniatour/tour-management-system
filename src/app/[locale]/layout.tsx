import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import Navigation from "@/components/Navigation";
import Sidebar from "@/components/Sidebar";
import UserFooter from "@/components/UserFooter";
import { AuthProvider } from "@/contexts/AuthContext";
import { FloatingChatProvider } from "@/contexts/FloatingChatContext";
import FloatingChatContainer from "@/components/FloatingChatContainer";
import StripeErrorHandler from "@/components/StripeErrorHandler";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { headers } from 'next/headers';
// duplicate import removed
import { createServerSupabase } from '@/lib/supabase-server';
import CartProviderWrapper from '@/components/CartProviderWrapper';

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial']
});

// Use generateMetadata instead of static metadata to inject dynamic favicon

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = await createServerSupabase();
    // 채널 중 파비콘이 설정된 항목을 우선 가져오고, self 타입을 우선 선택
    const { data } = await supabase
      .from('channels' as any)
      .select('favicon_url, type')
      .not('favicon_url', 'is', null)
      .limit(50);

    const faviconUrl = (data || [])
      .sort((a: any, b: any) => (a.type === 'self' ? -1 : b.type === 'self' ? 1 : 0))
      .find((c: any) => !!c.favicon_url)?.favicon_url as string | undefined;

    if (!faviconUrl) {
      return {
        manifest: '/manifest.json',
        other: {
          'preload-css': 'true'
        }
      }
    }

    return {
      manifest: '/manifest.json',
      icons: {
        icon: [{ url: faviconUrl }],
        shortcut: [{ url: faviconUrl }],
        apple: [{ url: faviconUrl }]
      },
      other: {
        'preload-css': 'true'
      }
    };
  } catch {
    return {
      manifest: '/manifest.json'
    };
  }
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  let messages;
  try {
    messages = await getMessages({ locale });
  } catch (error) {
    console.error('Failed to load messages:', error);
    messages = {};
  }
  
  // Admin 페이지인지 확인
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isAdminPage = pathname.includes('/admin');
  const isEmbedPage = pathname.includes('/embed');
  const isGuidePage = pathname.includes('/guide');
  const isPhotosPage = pathname.includes('/photos/'); // 사진 공유 링크 페이지
  const isCustomerPage = pathname.includes('/dashboard') || 
                         pathname.includes('/products') || 
                         pathname.includes('/off-schedule') ||
                         pathname === `/${locale}` ||
                         pathname === `/${locale}/`;

  // Admin, Embed, Guide, Photos 페이지인 경우 기본 레이아웃만 제공 (사이드바, 네비게이션, 푸터 없음)
  if (isAdminPage || isEmbedPage || isGuidePage || isPhotosPage) {
    return (
      <NextIntlClientProvider messages={messages} locale={locale}>
        <AuthProvider>
          <FloatingChatProvider>
            <StripeErrorHandler />
            <div className="min-h-screen bg-gray-50">
              {children}
              <FloatingChatContainer />
            </div>
          </FloatingChatProvider>
        </AuthProvider>
      </NextIntlClientProvider>
    );
  }

  // 일반 페이지인 경우 기존 레이아웃 사용
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <AuthProvider>
        <FloatingChatProvider>
          <StripeErrorHandler />
          <CartProviderWrapper>
            <div className="min-h-screen bg-gray-50">
              <Navigation />
              <div className="flex flex-col lg:flex-row">
                <Sidebar />
                <main className="flex-1 px-2 pt-4 lg:px-6 lg:pt-6 main-safe-area">
                  {children}
                </main>
              </div>
              <UserFooter locale={locale} />
              <FloatingChatContainer />
            </div>
          </CartProviderWrapper>
        </FloatingChatProvider>
      </AuthProvider>
          </NextIntlClientProvider>
  );
}
