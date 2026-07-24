'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useCustomerPageSoftReload } from '@/hooks/useCustomerPageSoftReload'
import {
  fetchProductAttachedWhyChooseItems,
  getWhyChooseLocalizedText,
  resolveWhyChooseIcon,
  type AttachedProductWhyChoose,
} from '@/lib/whyChooseLibrary'

type ProductWhyChooseDisplayProps = {
  productId: string
  variant?: 'default' | 'airbnb'
}

export default function ProductWhyChooseDisplay({
  productId,
  variant = 'default',
}: ProductWhyChooseDisplayProps) {
  const t = useTranslations('productDetail')
  const locale = useLocale()
  const [items, setItems] = useState<AttachedProductWhyChoose[]>([])
  const [loading, setLoading] = useState(true)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const attached = await fetchProductAttachedWhyChooseItems(supabase as never, productId)
      setItems(attached)
    } catch (error) {
      console.error('Why choose 로드 오류:', error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useCustomerPageSoftReload(loadItems)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const visibleItems = items
    .map((item) => ({
      item,
      title: getWhyChooseLocalizedText(item, 'title', locale),
      description: getWhyChooseLocalizedText(item, 'description', locale),
    }))
    .filter((row) => row.title)

  if (visibleItems.length === 0) return null

  return (
    <div className={variant === 'airbnb' ? 'airbnb-detail-why-choose' : 'space-y-4'}>
      {variant !== 'airbnb' ? (
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('whyChooseManiaTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('whyChooseManiaSubtitle')}</p>
        </div>
      ) : null}
      <ul
        className={
          variant === 'airbnb'
            ? 'airbnb-detail-why-choose-grid'
            : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
        }
      >
        {visibleItems.map(({ item, title, description }) => {
          const Icon = resolveWhyChooseIcon(item.icon_key)
          return (
            <li key={item.link_id} className="airbnb-detail-why-choose-card">
              <span className="airbnb-detail-why-choose-icon" aria-hidden>
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="airbnb-detail-why-choose-title">{title}</p>
                {description ? (
                  <p className="airbnb-detail-why-choose-desc">{description}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
