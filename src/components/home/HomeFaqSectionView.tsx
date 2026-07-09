'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import { getDemoFaq } from '@/components/home/homeExtendedSectionData'

export type FaqStructureVariant = 'accordion' | 'two-column' | 'compact-list'

function FaqList({ items, compact }: { items: ReturnType<typeof getDemoFaq>; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {items.map((item, i) => (
        <details
          key={i}
          className={`group cp-ui-card-surface rounded-xl border ${compact ? 'px-4 py-2' : 'px-5 py-3'}`}
        >
          <summary className="cursor-pointer font-semibold text-sm list-none flex items-center justify-between gap-2">
            {item.question}
            <span className="text-xs cp-ui-muted group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <p className={`cp-ui-muted ${compact ? 'text-xs mt-2' : 'text-sm mt-3'} leading-relaxed`}>
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  )
}

export default function HomeFaqSectionView({
  variant,
  t,
  zoneId,
  titleOverride,
  itemCount = 5,
}: {
  variant: FaqStructureVariant
  t: (key: string) => string
  zoneId: string
  titleOverride?: string
  itemCount?: number
}) {
  const items = getDemoFaq(t).slice(0, itemCount)
  const title = titleOverride?.trim() || t('faqTitle')

  if (variant === 'two-column') {
    const mid = Math.ceil(items.length / 2)
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="cp-ui-muted mb-8">{t('faqDesc')}</p>
          <div className="grid md:grid-cols-2 gap-6">
            <FaqList items={items.slice(0, mid)} />
            <FaqList items={items.slice(mid)} />
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'compact-list') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h2 className="text-xl font-bold mb-4">{title}</h2>
          <FaqList items={items} compact />
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">{title}</h2>
        <p className="text-center cp-ui-muted mb-8">{t('faqDesc')}</p>
        <FaqList items={items} />
      </div>
    </CustomerPageZone>
  )
}
