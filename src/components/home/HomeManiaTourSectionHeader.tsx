'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type ViewAllProps = {
  href: string
  label: string
  size?: 'default' | 'sm'
  target?: string
  rel?: string
}

export function HomeManiaTourViewAllLink({
  href,
  label,
  size = 'default',
  target,
  rel,
}: ViewAllProps) {
  return (
    <Link
      href={href}
      className={`kv-view-all-link${size === 'sm' ? ' kv-view-all-link--sm' : ''}`}
      {...(target ? { target } : {})}
      {...(rel ? { rel } : {})}
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}

export function HomeManiaTourSectionViewAllFooter(props: ViewAllProps) {
  return (
    <div className="kv-section-view-all-footer">
      <HomeManiaTourViewAllLink {...props} />
    </div>
  )
}

type Props = {
  title: string
  subtitle?: string | null
  align?: 'left' | 'center'
  viewAllHref?: string
  viewAllLabel?: string
  viewAllTarget?: string
  viewAllRel?: string
  viewAllSize?: 'default' | 'sm'
}

export default function HomeManiaTourSectionHeader({
  title,
  subtitle,
  align = 'left',
  viewAllHref,
  viewAllLabel,
  viewAllTarget,
  viewAllRel,
  viewAllSize = 'default',
}: Props) {
  const titleBlock = (
    <>
      <h2 className="kv-section-title">{title}</h2>
      {subtitle ? <p className="kv-section-subtitle">{subtitle}</p> : null}
    </>
  )

  if (align === 'center') {
    return (
      <div className="kv-section-header kv-section-header--center">
        {titleBlock}
      </div>
    )
  }

  if (!viewAllHref || !viewAllLabel) {
    return <div className="kv-section-header">{titleBlock}</div>
  }

  return (
    <div className="kv-section-header-row">
      <div className="kv-section-header">{titleBlock}</div>
      <div className="kv-section-view-all-inline">
        <HomeManiaTourViewAllLink
          href={viewAllHref}
          label={viewAllLabel}
          size={viewAllSize}
          {...(viewAllTarget ? { target: viewAllTarget } : {})}
          {...(viewAllRel ? { rel: viewAllRel } : {})}
        />
      </div>
    </div>
  )
}
