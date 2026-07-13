'use client'

import {
  TRAVEL_GUIDE_EDITOR_LOCALES,
  TRAVEL_GUIDE_FALLBACK_LOCALE,
  type TravelGuideEditorLocale,
} from '@/lib/travelGuideEditorLocales'
import { cn } from '@/lib/utils'

type Props = {
  activeLocale: TravelGuideEditorLocale
  onChange: (locale: TravelGuideEditorLocale) => void
  hasContent?: Partial<Record<TravelGuideEditorLocale, boolean>>
  fallbackHint?: string
}

export default function TravelGuideEditorLocaleTabs({
  activeLocale,
  onChange,
  hasContent,
  fallbackHint,
}: Props) {
  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Article language"
      >
        {TRAVEL_GUIDE_EDITOR_LOCALES.map((locale) => {
          const isActive = activeLocale === locale.code
          const filled = hasContent?.[locale.code]
          return (
            <button
              key={locale.code}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(locale.code)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-background text-foreground hover:bg-muted/60'
              )}
            >
              <span>{locale.label}</span>
              {filled ? (
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isActive ? 'bg-primary-foreground/90' : 'bg-primary'
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          )
        })}
      </div>
      {activeLocale !== TRAVEL_GUIDE_FALLBACK_LOCALE && fallbackHint ? (
        <p className="text-xs text-muted-foreground">{fallbackHint}</p>
      ) : null}
    </div>
  )
}
