import type { Metadata } from "next";
import LazyNavigation from "@/components/layout/LazyNavigation";
import LazySidebar from "@/components/layout/LazySidebar";
import LazyUserFooter from "@/components/layout/LazyUserFooter";
import { FloatingChatProvider } from "@/contexts/FloatingChatContext";
import LazyFloatingChatContainer from "@/components/layout/LazyFloatingChatContainer";
import LazyStripeErrorHandler from "@/components/layout/LazyStripeErrorHandler";
import LazyModalBackdropGuard from "@/components/layout/LazyModalBackdropGuard";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import CartProviderWrapper from '@/components/CartProviderWrapper';
import { CustomerPageEditModeProvider } from '@/components/product/CustomerPageEditModeProvider';
import { getLocaleLayoutMetadata } from '@/lib/channelFaviconMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return getLocaleLayoutMetadata();
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
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
  const isAuthPage = /\/auth(\/|$)/.test(pathname);

  // Admin, Embed, Photos, Auth(콜백): 기본 레이아웃만 (사이드바/네비 없음)
  if (isAdminPage || isEmbedPage || isPhotosPage || isAuthPage) {
    return (
      <NextIntlClientProvider messages={messages} locale={locale}>
        <FloatingChatProvider>
          <LazyStripeErrorHandler />
          <LazyModalBackdropGuard />
          <div className="min-h-screen bg-gray-50">
            {children}
            <LazyFloatingChatContainer />
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
          <LazyStripeErrorHandler />
          <LazyModalBackdropGuard />
          <div className="min-h-screen bg-gray-50">
            <LazyNavigation />
            {children}
            <LazyFloatingChatContainer />
          </div>
        </FloatingChatProvider>
      </NextIntlClientProvider>
    );
  }

  // 일반 페이지인 경우 기존 레이아웃 사용
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <FloatingChatProvider>
        <LazyStripeErrorHandler />
        <LazyModalBackdropGuard />
        <CartProviderWrapper>
          <CustomerPageEditModeProvider>
          <div className="min-h-screen bg-gray-50">
            <LazyNavigation />
            <div className="flex flex-col lg:flex-row">
              <LazySidebar />
              <main className="flex-1 px-2 pt-4 lg:px-6 lg:pt-6 main-safe-area">
                {children}
              </main>
            </div>
            <LazyUserFooter locale={locale} />
            <LazyFloatingChatContainer />
          </div>
          </CustomerPageEditModeProvider>
        </CartProviderWrapper>
      </FloatingChatProvider>
    </NextIntlClientProvider>
  );
}
