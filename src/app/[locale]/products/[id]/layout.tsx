import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { getProductSummaryByLocale } from '@/lib/productDetailDisplay'

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
  const isEnglish = locale === 'en'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      title: isEnglish ? 'Tour' : '투어',
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await fromUntypedTable(supabase, 'products')
      .select('name, name_ko, name_en, customer_name_ko, customer_name_en, description, summary_ko, summary_en')
      .eq('id', id)
      .eq('status', 'active')
      .eq('is_published', true)
      .maybeSingle()

    const row = data as ProductSeoRow | null
    if (!row) {
      return { title: isEnglish ? 'Tour' : '투어' }
    }

    const title =
      isEnglish
        ? row.customer_name_en?.trim() ||
          row.name_en?.trim() ||
          row.name?.trim() ||
          'Tour'
        : row.customer_name_ko?.trim() ||
          row.name_ko?.trim() ||
          row.name?.trim() ||
          '투어'

    const description =
      getProductSummaryByLocale(row, locale).slice(0, 160) ||
      (isEnglish
        ? `Book ${title} with MANIA TOUR.`
        : `${title} — MANIA TOUR에서 예약하세요.`)

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
    return { title: isEnglish ? 'Tour' : '투어' }
  }
}

export default function ProductDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
