'use client'

import ReactCountryFlag from 'react-country-flag'
import {
  formatTourLanguageAdminLabel,
  reservationOpsLanguageBucket,
  TOUR_LANGUAGE_OPTIONS,
} from '@/lib/reservationTourLanguage'

type TourLanguageBadgeProps = {
  tourLanguage?: string | null | undefined
  customerLanguage?: string | null | undefined
  locale?: string
  compact?: boolean
  showLabel?: boolean
  className?: string
}

export default function TourLanguageBadge({
  tourLanguage,
  customerLanguage,
  locale = 'ko',
  compact = false,
  showLabel = false,
  className = '',
}: TourLanguageBadgeProps) {
  const tour = reservationOpsLanguageBucket(tourLanguage, customerLanguage)
  const countryCode =
    TOUR_LANGUAGE_OPTIONS.find((option) => option.value === tour)?.countryCode ?? 'US'
  const label = formatTourLanguageAdminLabel(tourLanguage, customerLanguage, locale)

  return (
    <span
      className={`inline-flex shrink-0 items-center ${
        showLabel
          ? 'gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5'
          : ''
      } ${className}`.trim()}
      title={`투어 신청 언어: ${label}`}
      aria-label={`투어 신청 언어: ${label}`}
    >
      <ReactCountryFlag
        countryCode={countryCode}
        svg
        style={{
          width: compact ? '14px' : '16px',
          height: compact ? '11px' : '12px',
          borderRadius: '2px',
          flexShrink: 0,
        }}
      />
      {showLabel ? (
        <span className="text-[10px] font-medium leading-none text-gray-700 whitespace-nowrap">
          {label}
        </span>
      ) : null}
    </span>
  )
}
