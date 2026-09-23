'use client'

import ReactCountryFlag from 'react-country-flag'
import {
  narrationLanguageFlagCode,
  narrationLanguageTabLabel,
  normalizeNarrationLanguage,
} from '@/lib/tourNarrationLanguage'

export default function NarrationLanguageBadge({ language }: { language?: string | null }) {
  const raw = (language || '').trim()
  if (!raw) return null
  const code = normalizeNarrationLanguage(raw)
  const label = narrationLanguageTabLabel(code)

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5"
      title={label}
      aria-label={label}
    >
      <ReactCountryFlag
        countryCode={narrationLanguageFlagCode(code)}
        svg
        style={{ width: '14px', height: '10px', borderRadius: '2px', flexShrink: 0 }}
      />
      <span className="text-[10px] font-medium leading-none whitespace-nowrap text-gray-700">
        {label}
      </span>
    </span>
  )
}
