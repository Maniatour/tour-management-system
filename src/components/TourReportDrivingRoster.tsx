'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertTriangle, Car, Check } from 'lucide-react'
import {
  displayDrivingSegmentLabel,
  type TourReportDrivingSegment,
} from '@/lib/tourReportDrivingSegments'
import type { DrivingSeat } from '@/lib/tourReportActivityDetails'

export default function TourReportDrivingRoster({
  locale,
  segments,
  loading,
  myName,
  partnerName,
  partnerSubmitted,
  suggestedMineIds,
  assignment,
  claimedIds,
  unassignedIds,
  onToggle,
}: {
  locale: string
  segments: TourReportDrivingSegment[]
  loading?: boolean
  myName: string
  partnerName: string
  partnerSubmitted: boolean
  suggestedMineIds: Set<string>
  assignment: Record<string, DrivingSeat>
  claimedIds: Set<string>
  unassignedIds: string[]
  onToggle: (segmentId: string, seat: 'me' | 'partner') => void
}) {
  const getText = (ko: string, en: string) => (locale === 'en' ? en : ko)
  const mineCount = segments.filter((seg) => assignment[seg.id] === 'me').length
  const partnerCount = segments.filter((seg) => assignment[seg.id] === 'partner').length

  if (loading) {
    return <p className="text-sm text-gray-500">{getText('운전 구간 불러오는 중…', 'Loading driving segments…')}</p>
  }
  if (segments.length === 0) {
    return (
      <p className="text-sm text-amber-700">
        {getText('등록된 운전 구간이 없습니다.', 'No driving segments are set up yet.')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {getText(
          '구간마다 자신 또는 파트너 중 한 명만 체크하세요. 빈 칸 없이 전부 나눠 주세요.',
          'Check either you or your partner for each segment. Cover the full course with no gaps.'
        )}
      </p>
      {partnerSubmitted ? (
        <p className="text-sm text-muted-foreground">
          {getText(
            `${partnerName}이(가) 이미 제출한 일정입니다. 상대가 본인 운전으로 적은 구간을 가져가면 클레임으로 남습니다.`,
            `${partnerName} already submitted a schedule. Taking a segment they marked as their own is saved as a claim.`
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {getText(
            '파트너가 아직 제출 전이면, 상대가 운전한 구간도 지금 표시해 두면 다음 작성자에게 그대로 보입니다.',
            'If your partner has not submitted yet, you can still mark the segments they drove. They will see this schedule next.'
          )}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-border/80 bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] sm:text-xs">
          <div className="flex items-center gap-1.5 px-3 py-2">
            <Car className="h-3.5 w-3.5" />
            {getText('코스', 'Segment')}
          </div>
          <div className="px-1 py-2 text-center truncate" title={myName}>
            {myName || getText('자신', 'Me')}
          </div>
          <div className="px-1 py-2 text-center truncate" title={partnerName}>
            {partnerName || getText('파트너', 'Partner')}
          </div>
        </div>
        <div>
          {segments.map((segment) => {
            const seat = assignment[segment.id] || 'none'
            const label = displayDrivingSegmentLabel(segment, locale)
            const claimed = claimedIds.has(segment.id)
            const suggestedMine = suggestedMineIds.has(segment.id) && seat === 'me' && !claimed
            return (
              <div
                key={segment.id}
                className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] border-b border-border/60 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem]"
              >
                <div className="px-3 py-2">
                  <p className="text-sm font-medium leading-snug text-gray-900">{label}</p>
                  {claimed ? (
                    <p className="mt-0.5 text-[11px] font-medium text-amber-700">
                      {getText(`${partnerName} 본인 운전 기록을 수정(클레임)`, `Claim vs ${partnerName}`)}
                    </p>
                  ) : suggestedMine ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {getText(`${partnerName}이 당신이 운전했다고 표시`, `${partnerName} marked this as yours`)}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center justify-center px-1 py-1.5">
                  <SeatButton
                    pressed={seat === 'me'}
                    label={getText('자신', 'Me')}
                    onClick={() => onToggle(segment.id, 'me')}
                  />
                </div>
                <div className="flex items-center justify-center px-1 py-1.5">
                  <SeatButton
                    pressed={seat === 'partner'}
                    label={partnerName || getText('파트너', 'Partner')}
                    onClick={() => onToggle(segment.id, 'partner')}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem]">
          <div>
            {getText(
              `자신 ${mineCount} · 파트너 ${partnerCount} · 미배정 ${unassignedIds.length}`,
              `Me ${mineCount} · Partner ${partnerCount} · Open ${unassignedIds.length}`
            )}
          </div>
          <div className="text-center font-medium text-foreground">{mineCount}</div>
          <div className="text-center font-medium text-foreground">{partnerCount}</div>
        </div>
      </div>
      {unassignedIds.length > 0 ? (
        <p className="flex items-start gap-1.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {getText(
            `아직 배정되지 않은 구간이 ${unassignedIds.length}개 있습니다. 빠짐없이 나눠 주세요.`,
            `${unassignedIds.length} segment(s) are still unassigned. Cover every segment.`
          )}
        </p>
      ) : null}
    </div>
  )
}

function SeatButton({
  pressed,
  label,
  onClick,
}: {
  pressed: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={pressed ? 'default' : 'outline'}
      size="sm"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'h-10 w-10 rounded-lg p-0 text-base font-semibold',
        pressed ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
      )}
    >
      {pressed ? <Check className="h-4 w-4" /> : <span className="text-muted-foreground/80">-</span>}
    </Button>
  )
}
