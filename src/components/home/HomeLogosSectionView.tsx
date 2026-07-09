'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'

const PARTNER_LOGO_KEYS = [
  'partnerLogo1',
  'partnerLogo2',
  'partnerLogo3',
  'partnerLogo4',
  'partnerLogo5',
  'partnerLogo6',
] as const

export type LogosStructureVariant = 'row-scroll' | 'grid-six' | 'muted-strip'

export default function HomeLogosSectionView({
  variant,
  t,
  zoneId,
  titleOverride,
  itemCount = 6,
}: {
  variant: LogosStructureVariant
  t: (key: string) => string
  zoneId: string
  titleOverride?: string
  itemCount?: number
}) {
  const logos = PARTNER_LOGO_KEYS.slice(0, Math.min(12, itemCount)).map((key) => t(key))
  const title = titleOverride?.trim() || t('partnersTitle')

  const logoCell = (label: string, i: number) => (
    <div
      key={i}
      className="flex items-center justify-center rounded-xl border bg-white/80 px-4 py-3 text-xs font-semibold text-slate-500"
    >
      {label}
    </div>
  )

  if (variant === 'muted-strip') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="cp-ui-card-surface border-y py-6">
          <div className="max-w-7xl mx-auto px-4">
            <p className="text-center text-xs uppercase tracking-wider cp-ui-muted mb-4">{title}</p>
            <div className="flex flex-wrap justify-center gap-4 opacity-70">
              {logos.map((l, i) => logoCell(l, i))}
            </div>
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'grid-six') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10 text-center">
          <h2 className="text-lg font-semibold mb-6">{title}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">{logos.map(logoCell)}</div>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-center text-sm cp-ui-muted mb-4">{title}</p>
        <div className="flex gap-3 overflow-x-auto pb-1 justify-center flex-wrap">
          {logos.map(logoCell)}
        </div>
      </div>
    </CustomerPageZone>
  )
}
