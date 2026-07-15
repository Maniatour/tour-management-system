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
  /** 모달 헤더 등 한 줄 배치용 — 힌트 문구 없이 탭만 표시 */
  compact?: boolean
  className?: string
}

export default function TravelGuideEditorLocaleTabs({
  activeLocale,
  onChange,
  hasContent,
  fallbackHint,
  compact = false,
  className,
}: Props) {
  const tabs = (
    <div
      className={cn('flex flex-wrap gap-1.5 sm:gap-2', compact && 'flex-nowrap justify-end')}
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
              'inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors',
              compact ? 'px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm' : 'px-3 py-1.5 text-sm',
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
  )

  if (compact) {
    return <div className={cn(className)}>{tabs}</div>
  }

  return (
    <div className={cn('space-y-2', className)}>
      {tabs}
      {activeLocale !== TRAVEL_GUIDE_FALLBACK_LOCALE && fallbackHint ? (
        <p className="text-xs text-muted-foreground">{fallbackHint}</p>
      ) : null}
    </div>
  )
}
