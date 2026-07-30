'use client'

import { Home, Notebook, Plane } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import type { LucideIcon } from 'lucide-react'

export type ResidentStatusCounts = {
  usResident: number
  nonResident: number
  nonResidentUnder16: number
  nonResidentWithPass: number
  passCoveredCount: number
}

type ResidentStatusCardBadgeProps = {
  counts: ResidentStatusCounts
  onClick?: (e: React.MouseEvent) => void
  /** 투어 상세 모달 등 컴팩트 카드 */
  compact?: boolean
}

type StatusSegment = {
  key: string
  count: number
  Icon: LucideIcon
  iconClass: string
  badgeClass: string
}

export function ResidentStatusCardBadge({ counts, onClick, compact = false }: ResidentStatusCardBadgeProps) {
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isKo = locale === 'ko'

  const iconSizeClass = compact ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const countClass = `${compact ? 'text-[10px]' : 'text-xs'} font-semibold tabular-nums leading-none`
  const badgeBase = `inline-flex shrink-0 items-center rounded-full border transition-colors hover:opacity-90 ${
    compact ? 'gap-0 px-1 py-0' : 'gap-0.5 px-1.5 py-0.5'
  }`

  const segments: StatusSegment[] = []

  if (counts.usResident > 0) {
    segments.push({
      key: 'us_resident',
      count: counts.usResident,
      Icon: Home,
      iconClass: 'text-green-600',
      badgeClass: 'border-green-200 bg-green-50 text-green-700',
    })
  }
  if (counts.nonResident > 0) {
    segments.push({
      key: 'non_resident',
      count: counts.nonResident,
      Icon: Plane,
      iconClass: 'text-primary',
      badgeClass: 'border-primary/20 bg-primary/10 text-primary',
    })
  }
  if (counts.nonResidentUnder16 > 0) {
    segments.push({
      key: 'non_resident_under_16',
      count: counts.nonResidentUnder16,
      Icon: Plane,
      iconClass: 'text-orange-600',
      badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    })
  }
  if (counts.nonResidentWithPass > 0) {
    segments.push({
      key: 'non_resident_with_pass',
      count: counts.nonResidentWithPass,
      Icon: Notebook,
      iconClass: 'text-purple-600',
      badgeClass: 'border-purple-200 bg-purple-50 text-purple-700',
    })
  }

  if (segments.length === 0) return null

  const tooltipLines: string[] = []
  if (counts.usResident > 0) {
    tooltipLines.push(
      `${tCommon('statusUsResident')}: ${counts.usResident}${isKo ? '명' : ''}`
    )
  }
  if (counts.nonResident > 0) {
    tooltipLines.push(
      `${tCommon('statusNonResident')}: ${counts.nonResident}${isKo ? '명' : ''}`
    )
  }
  if (counts.nonResidentUnder16 > 0) {
    tooltipLines.push(
      `${isKo ? '비거주자 (16세 이하)' : 'Non-resident (under 16)'}: ${counts.nonResidentUnder16}${isKo ? '명' : ''}`
    )
  }
  if (counts.nonResidentWithPass > 0) {
    tooltipLines.push(
      `${tCommon('statusNonResidentWithPass')}: ${counts.nonResidentWithPass}${isKo ? '명' : ''}`
    )
  }
  if (counts.passCoveredCount > 0) {
    tooltipLines.push(
      `${isKo ? '패스 커버' : 'Pass covered'}: ${counts.passCoveredCount}${isKo ? '명' : ''}`
    )
  }

  const clickHint = isKo ? ' (클릭하여 변경)' : ' (click to edit)'

  return (
    <span
      className={`group relative inline-flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}
      aria-label={tooltipLines.join(', ')}
    >
      {segments.map(({ key, count, Icon, iconClass, badgeClass }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          className={`${badgeBase} ${badgeClass}`}
        >
          <Icon className={`${iconSizeClass} shrink-0 ${iconClass}`} aria-hidden />
          <span className={countClass}>{count}</span>
        </button>
      ))}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-2 text-left text-[11px] leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100 group-focus-within:block group-focus-within:opacity-100"
      >
        {tooltipLines.map((line) => (
          <span key={line} className="block whitespace-nowrap">
            {line}
          </span>
        ))}
        {onClick ? <span className="mt-1 block text-[10px] text-gray-300">{clickHint}</span> : null}
        <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-gray-900" />
      </span>
    </span>
  )
}
