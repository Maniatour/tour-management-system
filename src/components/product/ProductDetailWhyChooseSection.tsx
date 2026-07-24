'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useCustomerPageSoftReload } from '@/hooks/useCustomerPageSoftReload'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import ProductWhyChooseDisplay from '@/components/product/ProductWhyChooseDisplay'
import { fetchProductAttachedWhyChooseItems } from '@/lib/whyChooseLibrary'

type ProductDetailWhyChooseSectionProps = {
  productId: string
  variant?: 'default' | 'airbnb'
}

export default function ProductDetailWhyChooseSection({
  productId,
  variant = 'default',
}: ProductDetailWhyChooseSectionProps) {
  const t = useTranslations('productDetail')
  const [hasItems, setHasItems] = useState<boolean | null>(null)

  const checkItems = useCallback(async () => {
    try {
      const attached = await fetchProductAttachedWhyChooseItems(supabase as never, productId)
      setHasItems(attached.length > 0)
    } catch {
      setHasItems(false)
    }
  }, [productId])

  useEffect(() => {
    void checkItems()
  }, [checkItems])

  useCustomerPageSoftReload(checkItems)

  if (hasItems === null || !hasItems) return null

  if (variant === 'airbnb') {
    return (
      <>
        <AirbnbSectionDivider />
        <CustomerPageZone zone="detail-why-choose-mania" productId={productId}>
          <section className="airbnb-detail-section airbnb-detail-why-choose-section">
            <h2 className="airbnb-detail-section-title">{t('whyChooseManiaTitle')}</h2>
            <p className="airbnb-detail-why-choose-subtitle">{t('whyChooseManiaSubtitle')}</p>
            <ProductWhyChooseDisplay productId={productId} variant="airbnb" />
          </section>
        </CustomerPageZone>
      </>
    )
  }

  return (
    <CustomerPageZone zone="detail-why-choose-mania" productId={productId}>
      <ProductWhyChooseDisplay productId={productId} />
    </CustomerPageZone>
  )
}

function AirbnbSectionDivider() {
  return <hr className="airbnb-detail-divider" />
}
