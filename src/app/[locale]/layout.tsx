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
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import CartProviderWrapper from '@/components/CartProviderWrapper';
import { CustomerPageEditModeProvider } from '@/components/product/CustomerPageEditModeProvider';
import { CustomerPageFieldBindingsProvider } from '@/components/product/CustomerPageFieldBindingsProvider';
import CustomerPageGlobalThemeShell from '@/components/product/CustomerPageGlobalThemeShell';
import CustomerPageEditModeQuickBar from '@/components/product/CustomerPageEditModeQuickBar';
import { getLocaleLayoutMetadata, getCachedCustomerSiteBranding } from '@/lib/channelFaviconMetadata';
import { CustomerSiteBrandingProvider } from '@/contexts/CustomerSiteBrandingContext';
import { isSiteLocale, siteLocalePathTest } from '@/lib/siteLocales';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return getLocaleLayoutMetadata(locale)
}

function resolvePathname(
  headerPath: string | null,
  cookiePath: string | undefined
): string {
  const fromHeader = headerPath?.trim() ?? ''
  if (fromHeader) return fromHeader
  return cookiePath?.trim() ?? ''
}

function pathIsGuide(path: string): boolean {
  if (!path) return false
  return (
    siteLocalePathTest(path, '/guide(/|$)') || /\/guide(\/|$)/.test(path)
  )
}

function pathIsAdmin(path: string): boolean {
  if (!path) return false
  return (
    siteLocalePathTest(path, '/admin(/|$)') || /\/admin(\/|$)/.test(path)
  )
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  // Invalid segment (e.g. /undefined/...) must not reach NextIntlClientProvider —
  // ICU formatting throws: "Incorrect locale information provided (undefined)".
  if (!isSiteLocale(localeParam)) {
    notFound();
  }
  const locale = localeParam;
  setRequestLocale(locale);
  let messages;
  try {
    messages = await getMessages({ locale });
  } catch (error) {
    console.error('Failed to load messages:', error);
    messages = {};
  }
  
  // Admin/가이드 분기: 경로 신호가 있으면 가이드 (헤더 '0'이어도 /guide 경로면 가이드)
  const headersList = await headers();
  const cookieStore = await cookies();
  const headerPath = headersList.get('x-pathname')?.trim() ?? '';
  const cookiePath = cookieStore.get('x-pathname')?.value?.trim() ?? '';
  const pathname = resolvePathname(
    headersList.get('x-pathname'),
    cookieStore.get('x-pathname')?.value
  );
  const guideHeader = headersList.get('x-is-guide-route')?.trim() ?? null;
  const guideCookie = cookieStore.get('x-is-guide-route')?.value?.trim();
  const isGuidePage =
    pathIsGuide(pathname) ||
    pathIsGuide(headerPath) ||
    pathIsGuide(cookiePath) ||
    guideHeader === '1' ||
    (guideHeader !== '0' && guideCookie === '1');
  const isAdminPage =
    pathIsAdmin(pathname) ||
    pathIsAdmin(headerPath) ||
    pathIsAdmin(cookiePath);
  const isEmbedPage = pathname.includes('/embed');
  const isPhotosPage = pathname.includes('/photos/'); // 사진 공유 링크 페이지
  const isAuthPage = /\/auth(\/|$)/.test(pathname);
  const residentHeader = headersList.get('x-is-resident-check-route');
  const isResidentCheckGuestPage =
    residentHeader === '1' ||
    (residentHeader == null &&
      cookieStore.get('x-is-resident-check-route')?.value === '1') ||
    siteLocalePathTest(pathname, '/resident-check(/|$)') ||
    siteLocalePathTest(pathname, '/dashboard/resident-check(/|$)');
  const isCustomerHome = siteLocalePathTest(pathname, '/?$');
  const isCustomerProductsListing = siteLocalePathTest(pathname, '/products/?$');
  const isCustomerProductDetail = siteLocalePathTest(pathname, '/products/[^/]+/?$');
  const isCustomerTravelGuide = siteLocalePathTest(pathname, '/travel-guide(/|$)');
  const isCustomerWriteReview = siteLocalePathTest(pathname, '/reviews(/|$)');
  const fullWidthHeader = headersList.get('x-is-full-width-customer-page');
  const isFullWidthCustomerPage =
    fullWidthHeader === '1' ||
    (fullWidthHeader == null &&
      cookieStore.get('x-is-full-width-customer-page')?.value === '1') ||
    isCustomerHome ||
    isCustomerProductsListing ||
    isCustomerProductDetail ||
    isCustomerTravelGuide ||
    isCustomerWriteReview;

  const siteBranding = await getCachedCustomerSiteBranding();

  const brandingWrapper = (content: React.ReactNode) => (
    <CustomerSiteBrandingProvider logoUrl={siteBranding.logoUrl} hasCustomLogo={siteBranding.hasCustomLogo}>
      {content}
    </CustomerSiteBrandingProvider>
  );

  // Admin, Embed, Photos, Auth(콜백), 거주 확인 게스트 링크: 사이드바/네비 없음
  if (isAdminPage || isEmbedPage || isPhotosPage || isAuthPage || isResidentCheckGuestPage) {
    return (
      <NextIntlClientProvider messages={messages} locale={locale}>
        {brandingWrapper(
          <FloatingChatProvider>
            <LazyStripeErrorHandler />
            <LazyModalBackdropGuard />
            <div className="min-h-screen min-w-0 max-w-full overflow-x-clip">
              {children}
              <LazyFloatingChatContainer />
            </div>
          </FloatingChatProvider>
        )}
      </NextIntlClientProvider>
    );
  }

  // 가이드: Navigation은 여기서만 렌더 → guide/layout과 이중 헤더 방지 (x-pathname 누락 시 x-is-guide-route로 분기)
  if (isGuidePage) {
    return (
      <NextIntlClientProvider messages={messages} locale={locale}>
        {brandingWrapper(
          <FloatingChatProvider>
            <LazyStripeErrorHandler />
            <LazyModalBackdropGuard />
            <div className="min-h-screen w-full bg-white">
              <LazyNavigation />
              {children}
              <LazyFloatingChatContainer />
            </div>
          </FloatingChatProvider>
        )}
      </NextIntlClientProvider>
    );
  }

  // 일반 페이지인 경우 기존 레이아웃 사용
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      {brandingWrapper(
        <FloatingChatProvider>
          <LazyStripeErrorHandler />
          <LazyModalBackdropGuard />
          <CartProviderWrapper>
            <CustomerPageEditModeProvider>
            <CustomerPageFieldBindingsProvider>
            <CustomerPageGlobalThemeShell className="min-h-screen">
            <div className="min-h-screen">
              <LazyNavigation />
              <div className="flex flex-col lg:flex-row">
                <LazySidebar />
                <main
                  className={`flex-1 main-safe-area ${
                    isFullWidthCustomerPage || isGuidePage
                      ? 'px-0 pt-0'
                      : 'px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6'
                  }`}
                >
                  {children}
                </main>
              </div>
              <LazyUserFooter locale={locale} />
              <LazyFloatingChatContainer />
            </div>
            <CustomerPageEditModeQuickBar />
            </CustomerPageGlobalThemeShell>
            </CustomerPageFieldBindingsProvider>
            </CustomerPageEditModeProvider>
          </CartProviderWrapper>
        </FloatingChatProvider>
      )}
    </NextIntlClientProvider>
  );
}
