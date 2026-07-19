import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { getProductSummaryByLocale } from '@/lib/productDetailDisplay'
import { getPublicOperatorId } from '@/lib/operators/getPublicOperatorId'
import { getProductLocalizedField } from '@/lib/productFieldTranslations'
import { normalizeSiteLocale } from '@/lib/siteLocales'

type ProductSeoRow = {
  name: string | null
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string | null
  customer_name_en: string | null
  description: string | null
  summary_ko: string | null
  summary_en: string | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale, id } = await params
  const siteLocale = normalizeSiteLocale(locale)
  const fallbackTitle = siteLocale === 'ko' ? '투어' : 'Tour'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      title: fallbackTitle,
    }
  }

  try {
    const operatorId = await getPublicOperatorId()
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await fromUntypedTable(supabase, 'products')
      .select('name, name_ko, name_en, customer_name_ko, customer_name_en, description, summary_ko, summary_en')
      .eq('id', id)
      .eq('operator_id', operatorId)
      .eq('status', 'active')
      .eq('is_published', true)
      .maybeSingle()

    const row = data as ProductSeoRow | null
    if (!row) {
      return { title: fallbackTitle }
    }

    let translationRows: { product_id: string; field_key: string; locale: string; value: string | null }[] = []
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
    const description =
      summary.slice(0, 160) ||
      (siteLocale === 'ko'
        ? `${title} — MANIA TOUR에서 예약하세요.`
        : `Book ${title} with MANIA TOUR.`)

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
      },
    }
  } catch {
    return { title: fallbackTitle }
  }
}

export default function ProductDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
