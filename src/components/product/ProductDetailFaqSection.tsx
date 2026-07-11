'use client'

import { HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ProductFaqDisplay from '@/components/ProductFaqDisplay'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import ProductDetailSectionCard from '@/components/product/ui/ProductDetailSectionCard'

type ProductDetailFaqSectionProps = {
  productId: string
  variant?: 'default' | 'airbnb'
}

export default function ProductDetailFaqSection({
  productId,
  variant = 'default',
}: ProductDetailFaqSectionProps) {
  const t = useTranslations('productDetail')

  if (variant === 'airbnb') {
    return (
      <div className="airbnb-detail-faq">
        <h2 className="airbnb-detail-section-title">{t('faqSectionTitle')}</h2>
        <ProductFaqDisplay productId={productId} />
      </div>
    )
  }

  return (
    <CustomerPageZone zone="detail-faq-section">
      <ProductDetailSectionCard title={t('faqSectionTitle')} icon={HelpCircle} iconBgClassName="bg-amber-50" iconClassName="text-amber-600">
        <ProductFaqDisplay productId={productId} />
      </ProductDetailSectionCard>
    </CustomerPageZone>
  )
}
