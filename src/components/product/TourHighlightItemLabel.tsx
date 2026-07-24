'use client'

import ReactCountryFlag from 'react-country-flag'
import type { TourHighlightDisplayItem } from '@/lib/tourHighlightIcons'

type TourHighlightItemLabelProps = {
  item: TourHighlightDisplayItem
}

export default function TourHighlightItemLabel({ item }: TourHighlightItemLabelProps) {
  if (item.id === 'languages' && item.languageChips && item.languageChips.length > 0) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3 sm:gap-y-1.5">
        {item.languageChips.map((chip) => (
          <span key={chip.code} className="inline-flex items-center gap-1">
            <ReactCountryFlag
              countryCode={chip.countryCode}
              svg
              className="airbnb-detail-highlight-flag"
              aria-hidden
            />
            <span className="airbnb-detail-highlight-label">{chip.label}</span>
          </span>
        ))}
      </span>
    )
  }

  return <span className="airbnb-detail-highlight-label">{item.label}</span>
}
