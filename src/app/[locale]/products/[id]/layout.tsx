import type { Metadata } from 'next'
import { cache } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import JsonLd from '@/components/seo/JsonLd'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { getProductSummaryByLocale } from '@/lib/productDetailDisplay'
import { getPublicOperatorId } from '@/lib/operators/getPublicOperatorId'
import { getProductLocalizedField } from '@/lib/productFieldTranslations'
import { normalizeSiteLocale } from '@/lib/siteLocales'
import {
  buildCustomerPageMetadata,
  buildTourProductJsonLd,
  truncateSeoText,
} from '@/lib/customerSeo'

type ProductSeoRow = {
  name: string | null
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string | null
  customer_name_en: string | null
  description: string | null
  summary_ko: string | null
  summary_en: string | null
  base_price: number | null
}

async function fetchPrimaryImageUrl(
  supabase: SupabaseClient,
  productId: string
): Promise<string | null> {
  const { data: primaryMedia } = await fromUntypedTable(supabase, 'product_media')
    .select('file_url')
    .eq('product_id', productId)
    .eq('file_type', 'image')
    .eq('is_active', true)
    .eq('is_primary', true)
    .maybeSingle()

  const primaryUrl = (primaryMedia as { file_url?: string } | null)?.file_url
  if (primaryUrl) return primaryUrl

  const { data: firstMedia } = await fromUntypedTable(supabase, 'product_media')
    .select('file_url')
    .eq('product_id', productId)
    .eq('file_type', 'image')
    .eq('is_active', true)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (firstMedia as { file_url?: string } | null)?.file_url ?? null
}

const loadProductSeo = cache(async (locale: string, id: string) => {
  const siteLocale = normalizeSiteLocale(locale)
  const fallbackTitle = siteLocale === 'ko' ? '투어' : 'Tour'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      siteLocale,
      title: fallbackTitle,
      description:
        siteLocale === 'ko'
          ? 'Kovegas 투어 상품을 확인하세요.'
          : 'View this tour on Kovegas.',
      imageUrl: null as string | null,
      price: null as number | null,
    }
  }

  try {
    const operatorId = await getPublicOperatorId()
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await fromUntypedTable(supabase, 'products')
      .select(
        'name, name_ko, name_en, customer_name_ko, customer_name_en, description, summary_ko, summary_en, base_price'
      )
      .eq('id', id)
      .eq('operator_id', operatorId)
      .eq('status', 'active')
      .eq('is_published', true)
      .maybeSingle()

    const row = data as ProductSeoRow | null
    if (!row) {
      return {
        siteLocale,
        title: fallbackTitle,
        description:
          siteLocale === 'ko'
            ? 'Kovegas 투어 상품을 확인하세요.'
            : 'View this tour on Kovegas.',
        imageUrl: null,
        price: null,
      }
    }

    let translationRows: { product_id: string; field_key: string; locale: string; value: string | null }[] =
      []
    try {
      const { data: tr } = await fromUntypedTable(supabase, 'product_field_translations')
        .select('product_id, field_key, locale, value')
        .eq('product_id', id)
      translationRows = (tr || []) as typeof translationRows
    } catch {
      translationRows = []
    }

    const title =
      getProductLocalizedField(row, 'customer_name', siteLocale, translationRows) ||
      getProductLocalizedField(row, 'name', siteLocale, translationRows) ||
      row.name?.trim() ||
      fallbackTitle

    const summary =
      getProductLocalizedField(row, 'summary', siteLocale, translationRows) ||
      getProductSummaryByLocale(row, locale)

    const description = truncateSeoText(
      summary ||
        (siteLocale === 'ko'
          ? `${title} — Kovegas에서 예약하세요. 라스베이거스 출발 소그룹 투어.`
          : `Book ${title} with Kovegas. Small-group tours from Las Vegas.`)
    )

    const imageUrl = await fetchPrimaryImageUrl(supabase, id)

    return {
      siteLocale,
      title,
      description,
      imageUrl,
      price: typeof row.base_price === 'number' ? row.base_price : null,
    }
  } catch {
    return {
      siteLocale,
      title: fallbackTitle,
      description:
        siteLocale === 'ko'
          ? 'Kovegas 투어 상품을 확인하세요.'
          : 'View this tour on Kovegas.',
      imageUrl: null,
      price: null,
    }
  }
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale, id } = await params
  const seo = await loadProductSeo(locale, id)

  return buildCustomerPageMetadata({
    locale: seo.siteLocale,
    path: `/products/${id}`,
    title: seo.title,
    description: seo.description,
    imageUrl: seo.imageUrl,
  })
}

export default async function ProductDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const seo = await loadProductSeo(locale, id)

  return (
    <>
      <JsonLd
        data={buildTourProductJsonLd({
          locale: seo.siteLocale,
          productId: id,
          name: seo.title,
          description: seo.description,
          imageUrl: seo.imageUrl,
          price: seo.price,
        })}
      />
      {children}
    </>
  )
}
