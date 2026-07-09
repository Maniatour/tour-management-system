'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import type { StatsStructureVariant } from '@/lib/customerPageHomeStructure'
import type { StatItem } from '@/components/home/homeSectionTypes'

export default function HomeStatsSectionView({
  variant,
  stats,
}: {
  variant: StatsStructureVariant
  stats: StatItem[]
}) {
  if (variant === 'inline-strip') {
    return (
      <CustomerPageZone zone="home-stats">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap justify-between gap-4 py-4 px-6 rounded-2xl border cp-ui-card-surface">
            {stats.map((s, i) => (
              <div key={i} className="flex-1 min-w-[100px] text-center">
                <div className="text-xl font-bold cp-ui-stat-number">{s.number}</div>
                <div className="text-xs cp-ui-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'card-row') {
    return (
      <CustomerPageZone zone="home-stats">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="cp-ui-card-surface rounded-xl border p-5 text-center">
              <div className="text-2xl font-bold cp-ui-stat-number">{s.number}</div>
              <div className="text-xs cp-ui-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'highlight-band') {
    return (
      <CustomerPageZone zone="home-stats" className="cp-home-stats-band">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {stats.map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-bold cp-ui-stat-number">{s.number}</div>
              <div className="text-sm cp-ui-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-stats">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
        {stats.map((s, i) => (
          <div key={i}>
            <div className="text-2xl sm:text-4xl font-bold cp-ui-stat-number mb-1">{s.number}</div>
            <div className="text-sm cp-ui-muted">{s.label}</div>
          </div>
        ))}
      </div>
    </CustomerPageZone>
  )
}
