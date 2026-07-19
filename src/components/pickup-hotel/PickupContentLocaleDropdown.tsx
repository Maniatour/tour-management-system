'use client'

import LocaleDropdown from '@/components/LocaleDropdown'
import {
  DEFAULT_PICKUP_CONTENT_LOCALE,
  type PickupContentLocale,
} from '@/lib/pickupHotelLocales'

interface PickupContentLocaleDropdownProps {
  value: PickupContentLocale
  onChange: (locale: PickupContentLocale) => void
  className?: string
  /** Compact trigger for card header */
  size?: 'sm' | 'md'
  /** Show language label next to flag (page header). */
  showLabel?: boolean
}

export default function PickupContentLocaleDropdown({
  value,
  onChange,
  className = '',
  size = 'sm',
  showLabel = false,
}: PickupContentLocaleDropdownProps) {
  return (
    <LocaleDropdown
      value={value}
      onChange={onChange}
      className={className}
      size={size}
      showLabel={showLabel}
      ariaLabel="Content language"
    />
  )
}

export { DEFAULT_PICKUP_CONTENT_LOCALE }
