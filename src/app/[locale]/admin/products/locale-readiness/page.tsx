'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Languages } from 'lucide-react'
import ProductLocaleReadinessModal from '@/components/admin/ProductLocaleReadinessModal'
import { supabase } from '@/lib/supabase'
import type { ProductLocaleReadinessSource } from '@/lib/adminProductLocaleReadiness'

export default function ProductLocaleReadinessPage() {
  const t = useTranslations('products.localeReadiness')
  const locale = useLocale()
  const [products, setProducts] = useState<ProductLocaleReadinessSource[]>([])
  const [homepageChannelId, setHomepageChannelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const [{ data: productRows }, { data: channelRows }] = await Promise.all([
          supabase
            .from('products')
            .select(
              [
                'id',
                'name',
                'name_ko',
                'name_en',
                'customer_name_ko',
                'customer_name_en',
                'summary_ko',
                'summary_en',
                'status',
                'is_published',
              ].join(', ')
            )
            .order('name', { ascending: true }),
          supabase.from('channels').select('id, name').ilike('name', '%home%').limit(5),
        ])

        if (cancelled) return

        setProducts((productRows || []) as unknown as ProductLocaleReadinessSource[])
        const home =
          (channelRows || []).find((c) => /home|homepage|웹|홈/i.test(c.name || '')) ||
          (channelRows || [])[0]
        setHomepageChannelId(home?.id ?? null)
      } catch (error) {
        console.error('locale readiness page load error', error)
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Languages className="mt-0.5 h-6 w-6 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {t('pageTitle')}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
            </div>
          </div>
          <Link
            href={`/${locale}/admin/products`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToProducts')}
          </Link>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-600">
            {t('loading')}
          </div>
        ) : (
          <ProductLocaleReadinessModal
            isOpen
            embedded
            onClose={() => undefined}
            products={products}
            homepageChannelId={homepageChannelId}
            locale={locale}
          />
        )}
      </div>
    </div>
  )
}
