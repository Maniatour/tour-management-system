import type { Metadata } from 'next'
import { ROUTING_LOCALES, normalizeSiteLocale, type SiteLocale } from '@/lib/siteLocales'

/** Public marketing site name (customer-facing). */
export const CUSTOMER_SEO_SITE_NAME = 'Mania Tour'

export const CUSTOMER_SEO_BRAND_LINE = 'Las Vegas Mania Tour'

const DEFAULT_OG_PATH = '/images/destinations/grand-canyon.jpg'

type SeoCopy = {
  titleDefault: string
  titleTemplate: string
  description: string
  homeTitle: string
  homeDescription: string
  productsTitle: string
  productsDescription: string
  productsTagsTitle: string
  productsTagsDescription: string
  travelGuideTitle: string
  travelGuideDescription: string
  customTourTitle: string
  customTourDescription: string
}

const SEO_COPY: Record<string, SeoCopy> = {
  ko: {
    titleDefault: 'Mania Tour | 라스베이거스·그랜드캐년 투어',
    titleTemplate: '%s | Mania Tour',
    description:
      '라스베이거스 출발 그랜드캐년, 앤텔롭캐년, 자이언 등 남서부 USA 투어. 소그룹·한국어 가이드·호텔 픽업. Mania Tour에서 안전하게 예약하세요.',
    homeTitle: 'Mania Tour | 라스베이거스·그랜드캐년·앤텔롭 투어',
    homeDescription:
      '그랜드캐년, 앤텔롭캐년, 자이언, 브라이스 등 인기 투어를 한곳에서. 소그룹·현지 가이드·무료 취소 옵션. Mania Tour에서 바로 예약하세요.',
    productsTitle: '투어 상품',
    productsDescription:
      '라스베이거스 출발 당일·숙박 투어, 헬리콥터, 쇼 티켓까지. Mania Tour 전체 투어 상품을 확인하세요.',
    productsTagsTitle: '투어 카테고리·태그',
    productsTagsDescription: '목적지·여행 스타일별로 Mania Tour 투어를 찾아보세요.',
    travelGuideTitle: '트래블 가이드',
    travelGuideDescription: '라스베이거스와 남서부 USA 여행 팁, 일정 추천, 현지 가이드 아티클.',
    customTourTitle: '맞춤 투어 문의',
    customTourDescription: '일정·인원에 맞춘 프라이빗·소그룹 맞춤 투어를 문의하세요.',
  },
  en: {
    titleDefault: 'Mania Tour | Las Vegas & Grand Canyon Tours',
    titleTemplate: '%s | Mania Tour',
    description:
      'Grand Canyon, Antelope Canyon, Zion and more from Las Vegas. Small groups, hotel pickup, local guides. Book safely with Mania Tour.',
    homeTitle: 'Mania Tour | Las Vegas, Grand Canyon & Antelope Tours',
    homeDescription:
      'Book top Southwest USA tours from Las Vegas — Grand Canyon, Antelope Canyon, Zion, Bryce. Small groups and expert local guides.',
    productsTitle: 'Tours',
    productsDescription:
      'Browse day trips, overnight tours, helicopter flights and show tickets from Las Vegas with Mania Tour.',
    productsTagsTitle: 'Tour categories',
    productsTagsDescription: 'Explore Mania Tour by destination and travel style.',
    travelGuideTitle: 'Travel Guide',
    travelGuideDescription: 'Tips and guides for Las Vegas and the American Southwest.',
    customTourTitle: 'Custom tour inquiry',
    customTourDescription: 'Request a private or small-group custom itinerary.',
  },
}

export function getCustomerSeoCopy(locale: string): SeoCopy {
  const siteLocale = normalizeSiteLocale(locale)
  if (siteLocale === 'ko') return SEO_COPY.ko
  if (siteLocale === 'en') return SEO_COPY.en
  // Non ko/en: English marketing copy is safer for SEO than Korean
  return SEO_COPY.en
}

export function getCustomerSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`

  return 'http://localhost:3000'
}

export function absoluteCustomerUrl(pathname: string): string {
  const base = getCustomerSiteUrl()
  if (!pathname || pathname === '/') return base
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${base}${path}`
}

export function customerLocalizedPath(locale: string, path = '/'): string {
  const siteLocale = normalizeSiteLocale(locale)
  const normalized = !path || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`
  return `/${siteLocale}${normalized}`
}

export function customerLanguageAlternates(path = '/'): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {}
  for (const locale of ROUTING_LOCALES) {
    languages[locale] = absoluteCustomerUrl(customerLocalizedPath(locale, path))
  }
  languages['x-default'] = absoluteCustomerUrl(customerLocalizedPath('en', path))
  return {
    canonical: absoluteCustomerUrl(customerLocalizedPath('ko', path)),
    languages,
  }
}

/** Prefer caller locale for canonical when building page metadata. */
export function customerPageAlternates(
  locale: string,
  path = '/'
): NonNullable<Metadata['alternates']> {
  const siteLocale = normalizeSiteLocale(locale)
  const languages: Record<string, string> = {}
  for (const code of ROUTING_LOCALES) {
    languages[code] = absoluteCustomerUrl(customerLocalizedPath(code, path))
  }
  languages['x-default'] = absoluteCustomerUrl(customerLocalizedPath('en', path))
  return {
    canonical: absoluteCustomerUrl(customerLocalizedPath(siteLocale, path)),
    languages,
  }
}

export function truncateSeoText(value: string, max = 160): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

export function buildCustomerPageMetadata(options: {
  locale: string
  path: string
  title: string
  description: string
  imageUrl?: string | null
  type?: 'website' | 'article'
  noIndex?: boolean
}): Metadata {
  const siteLocale = normalizeSiteLocale(options.locale)
  const copy = getCustomerSeoCopy(siteLocale)
  const url = absoluteCustomerUrl(customerLocalizedPath(siteLocale, options.path))
  const image = options.imageUrl?.trim() || absoluteCustomerUrl(DEFAULT_OG_PATH)
  const title = options.title.trim() || copy.titleDefault
  const description = truncateSeoText(options.description || copy.description)

  return {
    title,
    description,
    applicationName: CUSTOMER_SEO_SITE_NAME,
    authors: [{ name: CUSTOMER_SEO_BRAND_LINE }],
    creator: CUSTOMER_SEO_BRAND_LINE,
    publisher: CUSTOMER_SEO_SITE_NAME,
    alternates: customerPageAlternates(siteLocale, options.path),
    openGraph: {
      type: options.type ?? 'website',
      locale: siteLocale,
      url,
      siteName: CUSTOMER_SEO_SITE_NAME,
      title,
      description,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: options.noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
  }
}

export function buildOrganizationJsonLd(locale: string) {
  const copy = getCustomerSeoCopy(locale)
  const siteUrl = getCustomerSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: CUSTOMER_SEO_SITE_NAME,
    alternateName: ['Las Vegas Mania Tour', '마니아투어', 'Kovegas'],
    url: absoluteCustomerUrl(customerLocalizedPath(locale, '/')),
    description: copy.description,
    image: absoluteCustomerUrl(DEFAULT_OG_PATH),
    areaServed: ['Las Vegas', 'Grand Canyon', 'Antelope Canyon', 'Southwest USA'],
    sameAs: [
      'https://www.instagram.com/lasvegasmania/',
      'https://www.facebook.com/lasvegasmania',
      'https://www.youtube.com/@lasvegasmania',
    ],
    brand: {
      '@type': 'Brand',
      name: CUSTOMER_SEO_BRAND_LINE,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/${normalizeSiteLocale(locale)}/products?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildTourProductJsonLd(options: {
  locale: string
  productId: string
  name: string
  description: string
  imageUrl?: string | null
  price?: number | null
  currency?: string
}) {
  const url = absoluteCustomerUrl(
    customerLocalizedPath(options.locale, `/products/${options.productId}`)
  )
  const image = options.imageUrl?.trim() || absoluteCustomerUrl(DEFAULT_OG_PATH)
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: options.name,
    description: truncateSeoText(options.description, 300),
    image: [image],
    url,
    brand: {
      '@type': 'Brand',
      name: CUSTOMER_SEO_SITE_NAME,
    },
    category: 'Tour',
  }

  if (options.price != null && options.price > 0) {
    data.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: options.currency || 'USD',
      price: Number(options.price.toFixed(2)),
      availability: 'https://schema.org/InStock',
    }
  }

  return data
}

export function buildArticleJsonLd(options: {
  locale: string
  slug: string
  title: string
  description: string
  imageUrl?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
  authorName?: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: options.title,
    description: truncateSeoText(options.description, 300),
    image: options.imageUrl?.trim() || absoluteCustomerUrl(DEFAULT_OG_PATH),
    datePublished: options.publishedAt || undefined,
    dateModified: options.updatedAt || options.publishedAt || undefined,
    author: {
      '@type': 'Person',
      name: options.authorName || CUSTOMER_SEO_BRAND_LINE,
    },
    publisher: {
      '@type': 'Organization',
      name: CUSTOMER_SEO_SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: absoluteCustomerUrl(DEFAULT_OG_PATH),
      },
    },
    mainEntityOfPage: absoluteCustomerUrl(
      customerLocalizedPath(options.locale, `/travel-guide/${options.slug}`)
    ),
  }
}

export function listCustomerSitemapLocales(): readonly SiteLocale[] {
  return ROUTING_LOCALES
}
