'use client'

import { useEffect, useState } from 'react'
import { Headphones } from 'lucide-react'
import { fetchTourNarrationPlays, type TourNarrationPlay } from '@/lib/tourNarrationPlays'

function formatDuration(totalSeconds: number, locale: string): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (locale === 'en') {
    if (minutes <= 0) return `${rest}s`
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`
  }
  if (minutes <= 0) return `${rest}초`
  return rest > 0 ? `${minutes}분 ${rest}초` : `${minutes}분`
}

function roleLabel(role: TourNarrationPlay['played_as'], locale: string): string {
  if (locale === 'en') {
    if (role === 'assistant') return 'Assistant'
    if (role === 'driver') return 'Driver'
    return 'Guide'
  }
  if (role === 'assistant') return '어시스턴트'
  if (role === 'driver') return '드라이버'
  return '가이드'
}

function formatWhen(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function TourNarrationPlayLog({
  tourId,
  locale = 'ko',
  compact = false,
  hideTitle = false,
}: {
  tourId: string
  locale?: string
  compact?: boolean
  hideTitle?: boolean
}) {
  const [plays, setPlays] = useState<TourNarrationPlay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchTourNarrationPlays(tourId)
      .then((rows) => {
        if (!cancelled) setPlays(rows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tourId])

  if (loading) return null
  if (plays.length === 0) {
    if (!compact) return null
    return (
      <div className="rounded-lg border border-dashed border-border/80 bg-white px-3 py-2.5">
        {!hideTitle ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
            <Headphones className="h-4 w-4 text-gray-500" />
            {locale === 'en' ? 'Narration playback' : '나레이션 재생 기록'}
          </p>
        ) : null}
        <p className={hideTitle ? 'text-xs text-gray-500' : 'mt-1 text-xs text-gray-500'}>
          {locale === 'en'
            ? 'No narration was played on this tour yet.'
            : '이 투어에서 아직 재생된 나레이션이 없습니다.'}
        </p>
      </div>
    )
  }

  return (
    <div className={compact ? 'rounded-lg border border-border/70 bg-white p-3' : 'mb-4'}>
      {!hideTitle ? (
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <Headphones className="h-4 w-4 text-gray-500" />
          {locale === 'en' ? 'Narration playback' : '나레이션 재생 기록'}
        </p>
      ) : null}
      <ul className="space-y-2">
        {plays.map((play) => (
          <li
            key={play.id}
            className="rounded-md bg-white px-3 py-2 text-sm text-gray-800 shadow-sm ring-1 ring-border/60"
          >
            <div className="font-medium text-gray-900">{play.material_title}</div>
            <div className="mt-0.5 text-xs text-gray-500">
              {play.played_by_name || play.played_by_email} · {roleLabel(play.played_as, locale)} ·{' '}
              {locale === 'en' ? `${play.play_count} time(s)` : `${play.play_count}회`} ·{' '}
              {formatDuration(play.play_seconds, locale)}
            </div>
            <div className="text-xs text-gray-400">
              {formatWhen(play.last_played_at, locale)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
