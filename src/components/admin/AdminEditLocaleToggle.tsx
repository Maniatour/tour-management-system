'use client'

import ReactCountryFlag from 'react-country-flag'
import {
  ADMIN_EDIT_LOCALE_OPTIONS,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'

type AdminEditLocaleToggleProps = {
  value: AdminEditLocale
  onChange: (locale: AdminEditLocale) => void
  groupLabel: string
  koLabel: string
  enLabel: string
  className?: string
}

export default function AdminEditLocaleToggle({
  value,
  onChange,
  groupLabel,
  koLabel,
  enLabel,
  className = '',
}: AdminEditLocaleToggleProps) {
  return (
    <div
      className={`admin-edit-locale-toggle ${className}`.trim()}
      role="group"
      aria-label={groupLabel}
    >
      {ADMIN_EDIT_LOCALE_OPTIONS.map((option) => {
        const label = option.locale === 'ko' ? koLabel : enLabel
        const isActive = value === option.locale

        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => onChange(option.locale)}
            className={`admin-edit-locale-toggle__btn${isActive ? ' is-active' : ''}`}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
          >
            <ReactCountryFlag
              countryCode={option.countryCode}
              svg
              aria-hidden
              className="admin-edit-locale-toggle__flag"
            />
          </button>
        )
      })}
    </div>
  )
}
