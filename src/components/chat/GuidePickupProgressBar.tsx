'use client'

import { CheckCircle2, MapPin, Radar } from 'lucide-react'
import type { PickupGeofenceStatus } from '@/hooks/usePickupGeofenceAutoComplete'

export type GuidePickupScheduleRow = {
  time: string
  date: string
  hotel: string
  location: string
  people: number
  sortMinutes: number
  lat: number | null
  lng: number | null
}

export interface GuidePickupProgressBarProps {
  schedule: GuidePickupScheduleRow[]
  language: 'ko' | 'en'
  lastCompletedIndex: number
  onMarkCurrentComplete: () => void | Promise<void>
  onShareLocation?: () => void
  sending: boolean
  gettingLocation?: boolean
  geofenceAuto: boolean
  onGeofenceAutoChange: (v: boolean) => void
  geofenceStatus: PickupGeofenceStatus
  nextStopHasCoords: boolean
}

function formatGeofenceError(
  err: string | null,
  lang: 'ko' | 'en'
): string | null {
  if (!err) return null
  if (lang === 'ko') {
    if (err === 'denied') return '위치 권한이 꺼져 있어 자동 감지를 할 수 없습니다.'
    if (err === 'unavailable') return '위치를 가져올 수 없습니다(GPS/실내).'
    if (err === 'timeout') return '위치 요청 시간이 초과되었습니다.'
    if (err === 'no_geolocation') return '이 기기에서는 위치 API를 지원하지 않습니다.'
    return '위치 오류'
  }
  if (err === 'denied') return 'Location permission denied — auto-detect is off.'
  if (err === 'unavailable') return 'Position unavailable (GPS/indoors).'
  if (err === 'timeout') return 'Location request timed out.'
  if (err === 'no_geolocation') return 'Geolocation is not supported on this device.'
  return 'Location error'
}

export default function GuidePickupProgressBar({
  schedule,
  language,
  lastCompletedIndex,
  onMarkCurrentComplete,
  onShareLocation,
  sending,
  gettingLocation = false,
  geofenceAuto,
  onGeofenceAutoChange,
  geofenceStatus,
  nextStopHasCoords
}: GuidePickupProgressBarProps) {
  const allDone = schedule.length > 0 && lastCompletedIndex >= schedule.length - 1
  const nextIdx = lastCompletedIndex + 1
  const nextStop = !allDone && nextIdx < schedule.length ? schedule[nextIdx] : null
  const doneCount = Math.max(0, lastCompletedIndex + 1)

  const t =
    language === 'ko'
      ? {
          title: '픽업 진행',
          hint: '첫 픽업 시각~마지막 픽업+30분 동안 표시됩니다.',
          progress: (d: number, n: number) => `완료 ${d} / ${n} 구간`,
          nextLabel: '다음 픽업',
          completeBtn: '이 호텔 픽업 완료 · 채팅에 알림',
          allDone: '오늘 예정된 호텔 픽업을 모두 완료했습니다.',
          shareLoc: '현재 위치 공유',
          people: '명',
          autoLabel: '자동 완료 (반경·체류)',
          autoHint:
            '다음 호텔 pin/지도 좌표 기준 약 140m 안에 45초 이상 머무르면 채팅에 자동 안내합니다. 채팅 탭을 켜 두는 것이 좋습니다.',
          noPin:
            '이 호텔에 좌표(pin 또는 지도 링크)가 없어 자동 감지를 쓸 수 없습니다. 관리자 픽업 호텔에서 pin을 넣어 주세요.',
          dist: (m: number) => `다음 호텔까지 약 ${m}m`,
          dwell: (s: number) => `반경 내 체류 · 약 ${s}초 후 자동 전송`,
          acc: (m: number) => `GPS 오차 약 ±${m}m`
        }
      : {
          title: 'Pickup run',
          hint: 'Shown from the first pickup time until 30 min after the last one.',
          progress: (d: number, n: number) => `${d} of ${n} stops done`,
          nextLabel: 'Next pickup',
          completeBtn: 'Mark this hotel done · notify chat',
          allDone: 'All scheduled pickups for today are complete.',
          shareLoc: 'Share current location',
          people: ' pax',
          autoLabel: 'Auto-complete (geofence)',
          autoHint:
            'When you stay ~45s inside ~140m of the next hotel (pin/map coords), we post the pickup update. Keep this tab open for best results.',
          noPin:
            'No coordinates for this stop (add pin or a maps link in Admin → Pickup hotels) — use the manual button.',
          dist: (m: number) => `~${m} m to next hotel`,
          dwell: (s: number) => `Inside zone · auto-send in ~${s}s`,
          acc: (m: number) => `GPS accuracy ~±${m} m`
        }

  const geoErrText = formatGeofenceError(geofenceStatus.error, language)

  return (
    <div className="flex-shrink-0 border-t border-b border-emerald-200/80 bg-gradient-to-r from-emerald-50/95 to-teal-50/90 px-2 py-2 lg:px-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-emerald-900">{t.title}</span>
        <span className="text-[10px] text-emerald-700/90 tabular-nums">
          {t.progress(doneCount, schedule.length)}
        </span>
      </div>
      <p className="text-[10px] text-emerald-800/80 mb-2 leading-snug">{t.hint}</p>

      {!allDone && nextStop ? (
        <div className="mb-2 rounded-md border border-emerald-200/90 bg-white/70 px-2 py-1.5 space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
              checked={geofenceAuto}
              onChange={(e) => onGeofenceAutoChange(e.target.checked)}
            />
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-900">
              <Radar size={14} className="text-emerald-700" />
              {t.autoLabel}
            </span>
          </label>
          <p className="text-[10px] text-emerald-800/85 leading-snug pl-6">{t.autoHint}</p>
          {!nextStopHasCoords ? (
            <p className="text-[10px] text-amber-800 bg-amber-50/90 border border-amber-200 rounded px-2 py-1 leading-snug">
              {t.noPin}
            </p>
          ) : geofenceAuto ? (
            <div className="text-[10px] text-emerald-900 space-y-0.5 pl-6">
              {geoErrText ? (
                <p className="text-red-700 font-medium">{geoErrText}</p>
              ) : geofenceStatus.watching && geofenceStatus.distanceM != null ? (
                <>
                  <p>{t.dist(geofenceStatus.distanceM)}</p>
                  {geofenceStatus.dwellRemainingSec != null && geofenceStatus.dwellRemainingSec > 0 ? (
                    <p className="font-medium text-emerald-800">{t.dwell(geofenceStatus.dwellRemainingSec)}</p>
                  ) : null}
                  {geofenceStatus.accuracyM != null ? (
                    <p className="text-emerald-700/90">{t.acc(geofenceStatus.accuracyM)}</p>
                  ) : null}
                </>
              ) : (
                <p className="text-emerald-700/80">
                  {language === 'ko' ? '위치 수신 대기 중…' : 'Waiting for GPS…'}
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {allDone ? (
        <div className="flex items-center gap-2 rounded-lg bg-white/80 border border-emerald-200 px-2.5 py-2 text-sm text-emerald-900">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{t.allDone}</span>
        </div>
      ) : nextStop ? (
        <div className="space-y-2">
          <div className="rounded-lg bg-white/90 border border-emerald-200 px-2.5 py-2 text-sm text-gray-900">
            <div className="text-[10px] font-medium text-emerald-800 uppercase tracking-wide mb-0.5">
              {t.nextLabel}
            </div>
            <div className="font-semibold leading-tight">{nextStop.hotel}</div>
            {nextStop.location ? (
              <div className="text-xs text-gray-600 mt-0.5">{nextStop.location}</div>
            ) : null}
            <div className="text-xs text-gray-700 mt-1">
              <span className="font-medium text-emerald-900">{nextStop.time}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span>
                {nextStop.people}
                {t.people}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sending || gettingLocation}
              onClick={() => void onMarkCurrentComplete()}
              className="inline-flex items-center justify-center gap-1.5 flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <CheckCircle2 size={16} />
              {t.completeBtn}
            </button>
            {onShareLocation ? (
              <button
                type="button"
                disabled={sending || gettingLocation}
                onClick={onShareLocation}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-emerald-300 bg-white text-emerald-900 text-xs font-medium hover:bg-emerald-50 disabled:opacity-50"
              >
                {gettingLocation ? (
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <MapPin size={16} />
                )}
                {t.shareLoc}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
