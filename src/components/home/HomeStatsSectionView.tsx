'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import type { StatsStructureVariant } from '@/lib/customerPageHomeStructure'
import type { StatItem } from '@/components/home/homeSectionTypes'

function GygStatsGrid({ stats }: { stats: StatItem[] }) {
  return (
    <div className="gyg-stats-grid">
      {stats.map((stat, index) => (
        <div key={index} className="gyg-stat-item">
          <div className="gyg-stat-number">{stat.number}</div>
          <div className="gyg-stat-label">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

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
        <section className="gyg-section gyg-section--stats">
          <div className="gyg-container">
            <div className="gyg-stats-strip">
              <GygStatsGrid stats={stats} />
            </div>
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'highlight-band') {
    return (
      <CustomerPageZone zone="home-stats">
        <section className="gyg-section gyg-section--stats-band">
          <div className="gyg-container">
            <GygStatsGrid stats={stats} />
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'card-row') {
    return (
      <CustomerPageZone zone="home-stats">
        <section className="gyg-section">
          <div className="gyg-container">
            <div className="gyg-stats-cards">
              {stats.map((stat, index) => (
                <div key={index} className="gyg-stat-card">
                  <div className="gyg-stat-number">{stat.number}</div>
                  <div className="gyg-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone="home-stats">
      <section className="gyg-section">
        <div className="gyg-container">
          <GygStatsGrid stats={stats} />
        </div>
      </section>
    </CustomerPageZone>
  )
}
