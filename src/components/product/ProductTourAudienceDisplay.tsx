'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useCustomerPageSoftReload } from '@/hooks/useCustomerPageSoftReload'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import {
  fetchProductAttachedTourAudienceItems,
  getTourAudienceLocalizedText,
  splitTourAudienceByKind,
  type AttachedProductTourAudience,
  type TourAudienceKind,
} from '@/lib/tourAudienceLibrary'

type ProductTourAudienceDisplayProps = {
  productId: string
  variant?: 'default' | 'airbnb'
}

function AudienceColumn({
  title,
  items,
  locale,
  kind,
}: {
  title: string
  items: AttachedProductTourAudience[]
  locale: string
  kind: TourAudienceKind
}) {
  if (items.length === 0) return null
  const Icon = kind === 'recommended' ? Check : X
  const iconClass =
    kind === 'recommended'
      ? 'bg-emerald-50 text-emerald-600'
      : 'bg-rose-50 text-rose-600'

  return (
    <div className="airbnb-tour-audience-column">
      <h4 className="airbnb-tour-audience-column-title">{title}</h4>
      <ul className="airbnb-tour-audience-list">
        {items.map((item) => {
          const label = getTourAudienceLocalizedText(item, locale)
          if (!label) return null
          return (
            <li key={item.link_id} className="airbnb-tour-audience-item">
              <span className={`airbnb-tour-audience-item-icon ${iconClass}`} aria-hidden>
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className="airbnb-tour-audience-item-text">{label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
export default function ProductTourAudienceDisplay({
  productId,
  variant = 'airbnb',
}: ProductTourAudienceDisplayProps) {
  const t = useTranslations('productDetail')
  const tAdmin = useTranslations('products.customerPageEdit.tourAudienceEmbed')
  const { isEditMode } = useCustomerPageEditMode()
  const locale = useLocale()
  const [items, setItems] = useState<AttachedProductTourAudience[]>([])
  const [loading, setLoading] = useState(true)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const attached = await fetchProductAttachedTourAudienceItems(supabase as never, productId)
      setItems(attached)
    } catch (error) {
      console.error('추천 대상 로드 오류:', error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useCustomerPageSoftReload(loadItems)

  const { recommended, notRecommended } = splitTourAudienceByKind(items)
  const hasVisibleContent =
    recommended.length > 0 || notRecommended.length > 0

  if (loading) {
    if (!isEditMode) return null
    return (
      <CustomerPageZone zone="detail-things-to-know-audience" productId={productId}>
        <div className={variant === 'airbnb' ? 'airbnb-tour-audience' : 'space-y-4'}>
          <h4 className="airbnb-tour-audience-heading">{t('tourAudienceTitle')}</h4>
          <p className="text-sm text-muted-foreground">{tAdmin('loading')}</p>
        </div>
      </CustomerPageZone>
    )
  }

  if (!hasVisibleContent && !isEditMode) return null

  if (!hasVisibleContent && isEditMode) {
    return (
      <CustomerPageZone zone="detail-things-to-know-audience" productId={productId}>
        <div className={variant === 'airbnb' ? 'airbnb-tour-audience' : 'space-y-4'}>
          {variant !== 'airbnb' ? (
            <h3 className="text-lg font-semibold text-foreground">{t('tourAudienceTitle')}</h3>
          ) : (
            <h4 className="airbnb-tour-audience-heading">{t('tourAudienceTitle')}</h4>
          )}
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            {tAdmin('empty')}
          </p>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="detail-things-to-know-audience" productId={productId}>
      <div className={variant === 'airbnb' ? 'airbnb-tour-audience' : 'space-y-4'}>
        {variant !== 'airbnb' ? (
          <h3 className="text-lg font-semibold text-foreground">{t('tourAudienceTitle')}</h3>
        ) : (
          <h4 className="airbnb-tour-audience-heading">{t('tourAudienceTitle')}</h4>
        )}
        <div className="airbnb-tour-audience-grid">
          <AudienceColumn
            title={t('tourAudienceRecommended')}
            items={recommended}
            locale={locale}
            kind="recommended"
          />
          <AudienceColumn
            title={t('tourAudienceNotRecommended')}
            items={notRecommended}
            locale={locale}
            kind="not_recommended"
          />
        </div>
      </div>
    </CustomerPageZone>
  )
}
