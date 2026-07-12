'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Props = {
  title: string
  subtitle?: string | null
  align?: 'left' | 'center'
  viewAllHref?: string
  viewAllLabel?: string
}

export default function HomeManiaTourSectionHeader({
  title,
  subtitle,
  align = 'left',
  viewAllHref,
  viewAllLabel,
}: Props) {
  if (align === 'center') {
    return (
      <div className="kv-section-header kv-section-header--center">
        <h2 className="kv-section-title">{title}</h2>
        {subtitle ? <p className="kv-section-subtitle">{subtitle}</p> : null}
      </div>
    )
  }

  if (!viewAllHref || !viewAllLabel) {
    return (
      <div className="kv-section-header">
        <h2 className="kv-section-title">{title}</h2>
        {subtitle ? <p className="kv-section-subtitle">{subtitle}</p> : null}
      </div>
    )
  }

  return (
    <div className="kv-section-header-row">
      <div>
        <h2 className="kv-section-title">{title}</h2>
        {subtitle ? <p className="kv-section-subtitle">{subtitle}</p> : null}
      </div>
      {viewAllHref && viewAllLabel ? (
        <Link href={viewAllHref} className="kv-view-all-link">
          {viewAllLabel}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  )
}
