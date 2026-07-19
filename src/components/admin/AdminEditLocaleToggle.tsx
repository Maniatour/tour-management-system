'use client'

import LocaleDropdown from '@/components/LocaleDropdown'
import {
  type AdminEditLocale,
} from '@/lib/adminEditLocales'

type AdminEditLocaleToggleProps = {
  value: AdminEditLocale
  onChange: (locale: AdminEditLocale) => void
  groupLabel: string
  /** @deprecated Labels come from SITE_LOCALES; kept for call-site compatibility */
  koLabel?: string
  /** @deprecated Labels come from SITE_LOCALES; kept for call-site compatibility */
  enLabel?: string
  className?: string
}

export default function AdminEditLocaleToggle({
  value,
  onChange,
  groupLabel,
  className = '',
}: AdminEditLocaleToggleProps) {
  return (
    <LocaleDropdown
      value={value}
      onChange={onChange}
      size="sm"
      showLabel
      ariaLabel={groupLabel}
      className={className}
    />
  )
}
