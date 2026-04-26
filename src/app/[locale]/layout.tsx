import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import Navigation from "@/components/Navigation";
import Sidebar from "@/components/Sidebar";
import UserFooter from "@/components/UserFooter";
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
  const fallbackMetadata: Metadata = {
    manifest: '/manifest.json',
    icons: {
      icon: [{ url: '/company-logo.png' }],
      shortcut: [{ url: '/company-logo.png' }],
      apple: [{ url: '/company-logo.png' }]
    },
    other: {
      'preload-css': 'true'
    }
  };

  try {
    const supabase = await createServerSupabase();
    // 1) 홈페이지 채널 아이콘(M00001 또는 이름에 홈페이지/homepage)을 최우선으로 조회
    const { data: homepageChannel } = await supabase
      .from('channels' as any)
      .select('id, name, favicon_url, type')
      .or('id.eq.M00001,name.ilike.%homepage%,name.ilike.%홈페이지%')
      .not('favicon_url', 'is', null)
      .limit(1)
      .maybeSingle();

    // 2) 없으면 self 채널 아이콘 조회
    let faviconUrl = homepageChannel?.favicon_url as string | undefined;
    if (!faviconUrl) {
      const { data: selfChannel } = await supabase
        .from('channels' as any)
        .select('favicon_url')
        .eq('type', 'self')
        .not('favicon_url', 'is', null)
        .limit(1)
        .maybeSingle();
      faviconUrl = selfChannel?.favicon_url as string | undefined;
    }

    // 3) 그래도 없으면 아무 채널 아이콘 1개
    if (!faviconUrl) {
      const { data: anyChannel } = await supabase
        .from('channels' as any)
        .select('favicon_url')
        .not('favicon_url', 'is', null)
        .limit(1)
        .maybeSingle();
      faviconUrl = anyChannel?.favicon_url as string | undefined;
    }

    if (!faviconUrl) {
      return fallbackMetadata;
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
    return fallbackMetadata;
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
  
  // Admin/가이드 분기: 미들웨어가 넣은 요청 헤더만 사용 (x-pathname 쿠키는 이전 페이지 값이 남아 /ko 홈이 admin 레이아웃으로 가는 등 오류 유발)
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';
  const isAdminPage = pathname.includes('/admin');
  const isEmbedPage = pathname.includes('/embed');
  const isGuidePage =
    pathname.includes('/guide') || headersList.get('x-is-guide-route') === '1';
  const isPhotosPage = pathname.includes('/photos/'); // 사진 공유 링크 페이지
  const isCustomerPage = pathname.includes('/dashboard') || 
                         pathname.includes('/products') || 
                         pathname.includes('/off-schedule') ||
                         pathname === `/${locale}` ||
                         pathname === `/${locale}/`;

  // Admin, Embed, Photos: 기본 레이아웃만 (사이드바/네비 없음)
  if (isAdminPage || isEmbedPage || isPhotosPage) {
    return (
      <NextIntlClientProvider messages={messages} locale={locale}>
        <FloatingChatProvider>
          <StripeErrorHandler />
          <div className="min-h-screen bg-gray-50">
            {children}
            <FloatingChatContainer />
          </div>
        </FloatingChatProvider>
      </NextIntlClientProvider>
    );
  }

  // 가이드: Navigation은 여기서만 렌더 → guide/layout과 이중 헤더 방지 (x-pathname 누락 시 x-is-guide-route로 분기)
  if (isGuidePage) {
    return (
      <NextIntlClientProvider messages={messages} locale={locale}>
        <FloatingChatProvider>
          <StripeErrorHandler />
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            {children}
            <FloatingChatContainer />
          </div>
        </FloatingChatProvider>
      </NextIntlClientProvider>
    );
  }

  // 일반 페이지인 경우 기존 레이아웃 사용
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
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
    </NextIntlClientProvider>
  );
}
