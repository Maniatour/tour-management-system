'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TourReportPace = 'all_clear' | 'has_issues'

export default function TourReportPaceToggle({
  value,
  onChange,
  locale = 'ko',
}: {
  value: TourReportPace
  onChange: (next: TourReportPace) => void
  locale?: string
}) {
  const isEn = locale === 'en'

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        {isEn ? 'How did the tour go?' : '오늘 투어는 어땠나요?'}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange('all_clear')}
          className={cn(
            'flex min-h-[52px] items-start gap-3 rounded-xl border px-3 py-3 text-left transition duration-200',
            value === 'all_clear'
              ? 'border-primary bg-primary/5 ring-2 ring-ring/20'
              : 'border-border bg-white hover:border-primary/40'
          )}
        >
          <CheckCircle2
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0',
              value === 'all_clear' ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <span>
            <span className="block text-sm font-semibold text-foreground">
              {isEn ? 'No issues today' : '오늘 이상 없음'}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {isEn
                ? 'Saves vehicle OK, no incidents, no lost items. Check guests, weather, stops, driving, then sign.'
                : '차량·사고·분실 없음으로 저장됩니다. 인원·날씨·방문·운전만 확인하고 서명하세요.'}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChange('has_issues')}
          className={cn(
            'flex min-h-[52px] items-start gap-3 rounded-xl border px-3 py-3 text-left transition duration-200',
            value === 'has_issues'
              ? 'border-primary bg-primary/5 ring-2 ring-ring/20'
              : 'border-border bg-white hover:border-primary/40'
          )}
        >
          <AlertTriangle
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0',
              value === 'has_issues' ? 'text-amber-600' : 'text-muted-foreground'
            )}
          />
          <span>
            <span className="block text-sm font-semibold text-foreground">
              {isEn ? 'Something to report' : '이슈·특이사항 있음'}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {isEn
                ? 'Add incidents, vehicle issues, lost items, photos, and notes.'
                : '사고, 차량, 분실, 사진, 메모를 추가로 작성합니다.'}
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}
