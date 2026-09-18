'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  SKIP_REASON_OPTIONS,
  displaySkipReasonLabel,
  isEnglishTourReportLocale,
  type SkippedStopsMap,
} from '@/lib/tourReportExtras'
import {
  TOUR_REPORT_QUOTA_SKIP_KEY,
  hasQuotaSkipReason,
} from '@/lib/tourReportStopRoles'

interface TourReportQuotaSkipProps {
  locale: string
  requiredCount: number
  qualifyingVisited: number
  shortfall: number
  skipped: SkippedStopsMap
  onChange: (next: SkippedStopsMap) => void
}

export default function TourReportQuotaSkip({
  locale,
  requiredCount,
  qualifyingVisited,
  shortfall,
  skipped,
  onChange,
}: TourReportQuotaSkipProps) {
  const getText = (ko: string, en: string) => (isEnglishTourReportLocale(locale) ? en : ko)
  if (shortfall <= 0) return null

  const entry = skipped[TOUR_REPORT_QUOTA_SKIP_KEY] ?? { reason: '', note: '' }
  const hasReason = hasQuotaSkipReason({ [TOUR_REPORT_QUOTA_SKIP_KEY]: entry })

  const patch = (patchEntry: Partial<{ reason: string; note: string }>) => {
    onChange({
      ...skipped,
      [TOUR_REPORT_QUOTA_SKIP_KEY]: { ...entry, ...patchEntry },
    })
  }

  return (
    <div className="space-y-2" data-missing={!hasReason ? 'true' : undefined}>
      <p className="text-sm text-amber-900">
        {getText(
          `필수 방문 ${requiredCount}곳 중 ${qualifyingVisited}곳만 선택했습니다. 부족분 ${shortfall}곳에 대한 사유를 적어 주세요. 대체 포인트 방문은 필수로 인정됩니다.`,
          `${qualifyingVisited} of ${requiredCount} required viewpoints selected. Write a reason for the remaining ${shortfall}. Alternate stops count toward the required total.`
        )}
      </p>
      <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {SKIP_REASON_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={entry.reason === opt.value ? 'default' : 'outline'}
              className={cn('h-8 px-2 text-xs', entry.reason === opt.value && 'shadow-sm')}
              onClick={() => patch({ reason: opt.value })}
            >
              {locale === 'en' ? opt.en : opt.ko}
            </Button>
          ))}
        </div>
        <Input
          value={entry.note}
          onChange={(e) => patch({ note: e.target.value })}
          placeholder={getText('추가 메모 (선택)', 'Optional note')}
          className="h-10"
        />
        {entry.reason ? (
          <p className="text-xs text-amber-800">
            {displaySkipReasonLabel(entry.reason, locale)}
            {entry.note.trim() ? ` — ${entry.note.trim()}` : ''}
          </p>
        ) : null}
      </div>
    </div>
  )
}
