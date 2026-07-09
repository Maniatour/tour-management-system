'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'

export type RichTextStructureVariant = 'centered-prose' | 'split-media' | 'highlight-box'

export default function HomeRichTextSectionView({
  variant,
  t,
  zoneId,
  titleOverride,
}: {
  variant: RichTextStructureVariant
  t: (key: string) => string
  zoneId: string
  titleOverride?: string
}) {
  const title = titleOverride?.trim() || t('richTextTitle')
  const body = t('richTextBody')

  if (variant === 'split-media') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-2 gap-8 items-center">
          <div className="rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 aspect-[4/3]" />
          <div>
            <h2 className="text-2xl font-bold mb-4">{title}</h2>
            <p className="cp-ui-muted leading-relaxed">{body}</p>
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'highlight-box') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="cp-ui-card-surface rounded-2xl border p-8 md:p-10">
            <h2 className="text-xl font-bold mb-4">{title}</h2>
            <p className="cp-ui-muted leading-relaxed">{body}</p>
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">{title}</h2>
        <p className="cp-ui-muted leading-relaxed text-left sm:text-center">{body}</p>
      </div>
    </CustomerPageZone>
  )
}
