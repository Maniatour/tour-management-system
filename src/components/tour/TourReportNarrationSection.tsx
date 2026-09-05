'use client'

import { Headphones } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import TourNarrationPlayLog from '@/components/tour/TourNarrationPlayLog'
import { cn } from '@/lib/utils'
import { isEnglishTourReportLocale } from '@/lib/tourReportExtras'

export default function TourReportNarrationSection({
  tourId,
  locale = 'ko',
  notPlayed,
  explainedInPerson,
  skipReason,
  onNotPlayedChange,
  onExplainedChange,
  onReasonChange,
}: {
  tourId: string
  locale?: string
  notPlayed: boolean
  explainedInPerson: boolean
  skipReason: string
  onNotPlayedChange: (value: boolean) => void
  onExplainedChange: (value: boolean) => void
  onReasonChange: (value: string) => void
}) {
  const isEn = isEnglishTourReportLocale(locale)

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
        <Headphones className="h-4 w-4 text-gray-500" />
        {isEn ? 'Narration' : '나레이션'}
      </p>
      <p className="text-xs text-muted-foreground">
        {isEn
          ? 'If the audio was not played, write a reason or check that you explained the tour sufficiently.'
          : '나레이션을 틀지 않았다면 사유를 적거나, 충분한 설명을 했음을 체크해 주세요.'}
      </p>

      <TourNarrationPlayLog tourId={tourId} locale={locale} compact hideTitle />

      <label
        htmlFor="narration_not_played"
        className={cn(
          'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5',
          notPlayed ? 'border-amber-200 bg-amber-50/80' : 'border-border/70 bg-white'
        )}
      >
        <Checkbox
          id="narration_not_played"
          checked={notPlayed}
          onCheckedChange={(checked) => onNotPlayedChange(checked === true)}
          className="mt-0.5 h-5 w-5"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium text-gray-900">
            {isEn ? 'Narration was not played' : '나레이션 재생 안 함'}
          </span>
          <span className="block text-xs text-muted-foreground">
            {isEn
              ? 'Use this when the recorded audio was not used on this tour.'
              : '녹음된 나레이션을 이번 투어에서 틀지 않았을 때 선택하세요.'}
          </span>
        </span>
      </label>

      {notPlayed ? (
        <div className="space-y-3 pl-0 sm:pl-1">
          <label
            htmlFor="narration_explained_in_person"
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5',
              explainedInPerson ? 'border-emerald-200 bg-emerald-50/80' : 'border-border/70 bg-white'
            )}
          >
            <Checkbox
              id="narration_explained_in_person"
              checked={explainedInPerson}
              onCheckedChange={(checked) => onExplainedChange(checked === true)}
              className="mt-0.5 h-5 w-5"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium text-gray-900">
                {isEn
                  ? 'Did not play narration, but explained it sufficiently'
                  : '나레이션은 틀지 않았지만, 충분한 설명을 했습니다'}
              </span>
              <span className="block text-xs text-muted-foreground">
                {isEn
                  ? 'Check this if live commentary covered the same content.'
                  : '직접 설명으로 같은 내용을 충분히 전달했다면 체크하세요.'}
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="narration_skip_reason" className="text-sm font-medium">
              {isEn ? 'Reason it was not played' : '재생하지 않은 사유'}
              {explainedInPerson ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  {isEn ? '(optional)' : '(선택)'}
                </span>
              ) : null}
            </Label>
            <Textarea
              id="narration_skip_reason"
              value={skipReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={
                isEn
                  ? 'Example: audio issue, guests asked for a live Korean guide, vehicle speaker problem.'
                  : '예: 오디오 오류, 손님이 한국어 현장 가이드를 요청, 차량 스피커 문제.'
              }
              rows={3}
              className="min-h-[88px] resize-y bg-white"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
