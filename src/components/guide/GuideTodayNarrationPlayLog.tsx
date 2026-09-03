'use client'

import { useEffect, useState } from 'react'
import { Headphones } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import {
  fetchTourNarrationPlaysForTourIds,
  getTodayAssignedTourIds,
  type TourNarrationPlay,
} from '@/lib/tourNarrationPlays'

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

export default function GuideTodayNarrationPlayLog({ locale = 'ko' }: { locale?: string }) {
  const { user, isSimulating } = useAuth()
  const { isPlaying, currentTrack } = useAudioPlayer()
  const email = isSimulating ? null : user?.email || null
  const [tourCount, setTourCount] = useState(0)
  const [plays, setPlays] = useState<TourNarrationPlay[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!email) {
      setReady(true)
      setTourCount(0)
      setPlays([])
      return
    }
    void (async () => {
      const ids = await getTodayAssignedTourIds(email)
      const rows = ids.length > 0 ? await fetchTourNarrationPlaysForTourIds(ids) : []
      if (cancelled) return
      setTourCount(ids.length)
      setPlays(rows)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [email, isPlaying, currentTrack?.id])

  if (!ready || tourCount === 0) return null

  const isEn = locale === 'en'

  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
        <Headphones className="h-4 w-4 text-gray-500" />
        {isEn ? "Today's narration playback" : '오늘 나레이션 재생 기록'}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {isEn
          ? "Playback is saved to today's assigned tour report."
          : '재생하면 오늘 배정된 투어 리포트에 기록이 첨부됩니다.'}
      </p>
      {plays.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">
          {isEn
            ? "No narration has been played on today's tour yet. If you skip it, record the reason in the tour report."
            : '아직 오늘 투어에서 재생한 나레이션이 없습니다. 틀지 않았다면 투어 리포트에 사유를 남겨 주세요.'}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {plays.map((play) => (
            <li key={play.id} className="text-xs text-gray-700">
              <span className="font-medium text-gray-900">{play.material_title}</span>
              <span className="text-gray-500">
                {' '}
                · {play.played_by_name || play.played_by_email} · {roleLabel(play.played_as, locale)}{' '}
                · {isEn ? `${play.play_count} time(s)` : `${play.play_count}회`} ·{' '}
                {formatDuration(play.play_seconds, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
