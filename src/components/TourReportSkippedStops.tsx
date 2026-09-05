'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  SKIP_REASON_OPTIONS,
  displaySkipReasonLabel,
  isEnglishTourReportLocale,
  type SkippedStopsMap,
} from '@/lib/tourReportExtras'

interface StopOption {
  id: string
  label: string
  depth: number
}

interface TourReportSkippedStopsProps {
  locale: string
  stops: StopOption[]
  visitedIds: string[]
  skipped: SkippedStopsMap
  onChange: (next: SkippedStopsMap) => void
}

export default function TourReportSkippedStops({
  locale,
  stops,
  visitedIds,
  skipped,
  onChange,
}: TourReportSkippedStopsProps) {
  const getText = (ko: string, en: string) => (isEnglishTourReportLocale(locale) ? en : ko)
  const visited = new Set(visitedIds)
  const skippable = stops.filter((s) => !visited.has(s.id))
  const skippedIds = Object.keys(skipped).filter((id) => !visited.has(id))

  if (skippable.length === 0) return null

  const toggleSkip = (id: string) => {
    const next = { ...skipped }
    if (next[id]) {
      delete next[id]
    } else {
      next[id] = { reason: '', note: '' }
    }
    onChange(next)
  }

  const patch = (id: string, patchEntry: Partial<{ reason: string; note: string }>) => {
    const current = skipped[id] ?? { reason: '', note: '' }
    onChange({ ...skipped, [id]: { ...current, ...patchEntry } })
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {getText(
          '방문하지 않은 곳 중 스킵한 포인트를 고르고 이유를 남겨 주세요.',
          'Mark skipped stops you did not visit and choose a reason.'
        )}
      </p>
      <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-2 py-2">
        {skippable.map((stop) => {
          const isSkipped = Boolean(skipped[stop.id])
          const entry = skipped[stop.id]
          return (
            <div
              key={stop.id}
              className="border-b border-amber-100/90 py-1 last:border-b-0"
              style={{ paddingLeft: Math.min(stop.depth, 12) * 14 }}
            >
              <Button
                type="button"
                variant={isSkipped ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => toggleSkip(stop.id)}
                className="my-1 flex min-h-[42px] w-full items-center justify-start gap-2 px-2 text-xs md:min-h-[38px] md:text-sm"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
                    isSkipped ? 'border-red-600 bg-red-600' : 'border-gray-300'
                  )}
                >
                  {isSkipped && (
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                <span className="whitespace-normal text-left font-medium leading-snug">{stop.label}</span>
                <span className="ml-auto shrink-0 text-[11px] opacity-80">
                  {isSkipped ? getText('스킵됨', 'Skipped') : getText('스킵', 'Skip')}
                </span>
              </Button>
              {isSkipped && entry && (
                <div className="mb-2 space-y-2 pl-6">
                  <div className="flex flex-wrap gap-1.5">
                    {SKIP_REASON_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        size="sm"
                        variant={entry.reason === opt.value ? 'default' : 'outline'}
                        className="h-8 px-2 text-xs"
                        onClick={() => patch(stop.id, { reason: opt.value })}
                      >
                        {locale === 'en' ? opt.en : opt.ko}
                      </Button>
                    ))}
                  </div>
                  <Input
                    value={entry.note}
                    onChange={(e) => patch(stop.id, { note: e.target.value })}
                    placeholder={getText('추가 메모 (선택)', 'Optional note')}
                    className="h-10"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {skippedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skippedIds.map((id) => {
            const stop = stops.find((s) => s.id === id)
            const entry = skipped[id]
            const reason = entry?.reason ? displaySkipReasonLabel(entry.reason, locale) : ''
            return (
              <Badge key={id} variant="destructive">
                {stop?.label ?? id}
                {reason ? ` · ${reason}` : ''}
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
