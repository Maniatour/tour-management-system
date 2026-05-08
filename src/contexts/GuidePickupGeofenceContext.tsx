'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { createClientSupabase } from '@/lib/supabase'
import {
  fetchPickupScheduleForTour,
  type GuidePickupScheduleRow
} from '@/lib/fetchPickupScheduleForTour'
import { localDateYmd } from '@/lib/localDateYmd'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import {
  isWithinGuidePickupShareWindow,
  buildPickupCompleteChatMessages
} from '@/lib/tourPickupLiveWindow'
import { guideChatSendTextMessage } from '@/lib/guideChatSendTextMessage'
import { formatTourChatStaffDisplayName } from '@/lib/tourChatStaffDisplay'
import {
  usePickupGeofenceAutoComplete,
  type PickupGeofenceStatus
} from '@/hooks/usePickupGeofenceAutoComplete'

const IDLE: PickupGeofenceStatus = {
  watching: false,
  distanceM: null,
  accuracyM: null,
  error: null,
  dwellRemainingSec: null
}

type ActivePickupContext = {
  tourId: string
  tourDate: string
  roomId: string
  schedule: GuidePickupScheduleRow[]
}

export type GuidePickupGeofenceContextValue = {
  geofenceAuto: boolean
  setGeofenceAutoPersist: (v: boolean) => void
  layoutTrackingTourId: string | null
  layoutGeofenceStatus: PickupGeofenceStatus
}

const GuidePickupGeofenceContext = createContext<GuidePickupGeofenceContextValue | null>(null)

export function useGuidePickupGeofenceOptional(): GuidePickupGeofenceContextValue | null {
  return useContext(GuidePickupGeofenceContext)
}

function GuideAppPickupGeofenceRunner({
  guideEmail,
  locale,
  geofenceAuto,
  onLayoutState
}: {
  guideEmail: string | null | undefined
  locale: 'ko' | 'en'
  geofenceAuto: boolean
  onLayoutState: (tourId: string | null, status: PickupGeofenceStatus) => void
}) {
  const supabase = useMemo(() => createClientSupabase(), [])
  const [activeContext, setActiveContext] = useState<ActivePickupContext | null>(null)
  const [senderTeamFields, setSenderTeamFields] = useState<{
    nick_name?: string | null
    name_ko?: string | null
    name_en?: string | null
  } | null>(null)

  const [lastPickupCompletedIndex, setLastPickupCompletedIndex] = useState(-1)
  const lastIdxRef = useRef(-1)
  lastIdxRef.current = lastPickupCompletedIndex

  const autoBusyRef = useRef(false)

  useEffect(() => {
    if (!guideEmail) {
      setSenderTeamFields(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('team')
        .select('nick_name, name_ko, name_en')
        .eq('email', guideEmail)
        .maybeSingle<{
          nick_name: string | null
          name_ko: string | null
          name_en: string | null
        }>()
      if (cancelled) return
      setSenderTeamFields(
        data
          ? {
              nick_name: data.nick_name,
              name_ko: data.name_ko,
              name_en: data.name_en
            }
          : null
      )
    })()
    return () => {
      cancelled = true
    }
  }, [guideEmail, supabase])

  const senderName = useMemo(() => {
    if (!guideEmail) return '가이드'
    return formatTourChatStaffDisplayName(guideEmail, senderTeamFields)
  }, [guideEmail, senderTeamFields])

  const loadActiveTour = useCallback(async () => {
    if (!guideEmail?.trim()) {
      setActiveContext(null)
      return
    }
    const email = guideEmail.trim()
    const todayStr = localDateYmd()

    /** 어시스턴트 GPS는 사용하지 않음 — 배정 가이드(`tour_guide_id`) 본인 기기만 추적 */
    const { data: tours, error } = await supabase
      .from('tours')
      .select('id, tour_date, tour_status')
      .eq('tour_date', todayStr)
      .eq('tour_guide_id', email)

    if (error) {
      console.error('[GuideAppPickupGeofenceRunner] tours query:', error)
      setActiveContext(null)
      return
    }

    const rows = (tours ?? []).filter((t) =>
      !isTourCancelled((t as { tour_status?: string | null }).tour_status)
    )

    type Cand = ActivePickupContext & { firstMin: number }
    let best: Cand | null = null

    for (const t of rows) {
      const tourId = (t as { id: string }).id
      const tourDate = (t as { tour_date: string }).tour_date
      const schedule = await fetchPickupScheduleForTour(supabase, tourId, tourDate)
      if (schedule.length === 0) continue
      if (!isWithinGuidePickupShareWindow(tourDate, schedule)) continue

      const { data: room } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('tour_id', tourId)
        .eq('is_active', true)
        .maybeSingle()

      const roomId = (room as { id: string } | null)?.id
      if (!roomId) continue

      const firstMin = Math.min(...schedule.map((s) => s.sortMinutes))
      if (!best || firstMin < best.firstMin) {
        best = { tourId, tourDate, roomId, schedule, firstMin }
      }
    }

    if (!best) {
      setActiveContext(null)
      return
    }

    const { firstMin: _drop, ...ctx } = best
    setActiveContext(ctx)
  }, [guideEmail, supabase])

  useEffect(() => {
    void loadActiveTour()
    const id = window.setInterval(() => void loadActiveTour(), 90_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadActiveTour()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loadActiveTour])

  useEffect(() => {
    setLastPickupCompletedIndex(-1)
  }, [activeContext?.tourId, activeContext?.tourDate])

  useEffect(() => {
    if (!activeContext?.tourId || !activeContext.tourDate || activeContext.schedule.length === 0) return
    try {
      const raw = localStorage.getItem(
        `tms_guide_pickup_idx_${activeContext.tourId}_${activeContext.tourDate}`
      )
      if (raw == null) return
      const n = parseInt(raw, 10)
      if (Number.isNaN(n)) return
      const maxIdx = activeContext.schedule.length - 1
      const clamped = Math.min(Math.max(-1, n), maxIdx)
      setLastPickupCompletedIndex(clamped)
    } catch {
      /* ignore */
    }
  }, [activeContext?.tourId, activeContext?.tourDate, activeContext?.schedule.length])

  const nextPickupGeofenceIndex = lastPickupCompletedIndex + 1
  const nextRow = activeContext?.schedule[nextPickupGeofenceIndex]
  const nextStopCoords =
    nextRow && nextRow.lat != null && nextRow.lng != null
      ? { lat: nextRow.lat, lng: nextRow.lng }
      : { lat: null as number | null, lng: null as number | null }

  const pickupRunAllDone =
    Boolean(activeContext?.schedule.length) &&
    lastPickupCompletedIndex >= (activeContext?.schedule.length ?? 0) - 1

  const geofenceTrackingEnabled =
    Boolean(activeContext) &&
    geofenceAuto &&
    !pickupRunAllDone &&
    nextPickupGeofenceIndex < (activeContext?.schedule.length ?? 0) &&
    nextStopCoords.lat != null

  const onAutoComplete = useCallback(async () => {
    if (!activeContext || !guideEmail) return
    if (autoBusyRef.current) return
    autoBusyRef.current = true
    try {
      const idx = lastIdxRef.current + 1
      if (idx >= activeContext.schedule.length) return
      const current = activeContext.schedule[idx]
      const next = idx + 1 < activeContext.schedule.length ? activeContext.schedule[idx + 1] : null
      const { ko, en } = buildPickupCompleteChatMessages(locale, current, next)
      const text = locale === 'ko' ? ko : en
      const res = await guideChatSendTextMessage(supabase, {
        roomId: activeContext.roomId,
        guideEmail,
        senderName,
        messageText: text
      })
      if (!res.ok) {
        console.error('[GuideAppPickupGeofenceRunner] send failed:', res.error)
        return
      }
      setLastPickupCompletedIndex(idx)
      try {
        localStorage.setItem(
          `tms_guide_pickup_idx_${activeContext.tourId}_${activeContext.tourDate}`,
          String(idx)
        )
      } catch {
        /* ignore */
      }
    } finally {
      autoBusyRef.current = false
    }
  }, [activeContext, guideEmail, locale, senderName, supabase])

  const geofenceStatus = usePickupGeofenceAutoComplete({
    enabled: geofenceTrackingEnabled,
    nextStopIndex: nextPickupGeofenceIndex,
    targetLat: nextStopCoords.lat,
    targetLng: nextStopCoords.lng,
    onAutoComplete
  })

  const layoutTrackingKey = activeContext?.tourId ?? null
  useEffect(() => {
    if (layoutTrackingKey == null) {
      onLayoutState(null, IDLE)
      return
    }
    onLayoutState(layoutTrackingKey, geofenceStatus)
  }, [layoutTrackingKey, geofenceStatus, onLayoutState])

  return null
}

export function GuidePickupGeofenceProvider({
  children,
  guideEmail,
  locale
}: {
  children: React.ReactNode
  guideEmail: string | null | undefined
  locale: 'ko' | 'en'
}) {
  const [geofenceAuto, setGeofenceAuto] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return localStorage.getItem('tms_guide_geofence_auto') !== '0'
    } catch {
      return true
    }
  })

  const setGeofenceAutoPersist = useCallback((v: boolean) => {
    setGeofenceAuto(v)
    try {
      localStorage.setItem('tms_guide_geofence_auto', v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const [layoutState, setLayoutState] = useState<{
    trackingTourId: string | null
    status: PickupGeofenceStatus
  }>({
    trackingTourId: null,
    status: IDLE
  })

  const onLayoutState = useCallback((tourId: string | null, status: PickupGeofenceStatus) => {
    setLayoutState({ trackingTourId: tourId, status })
  }, [])

  const value = useMemo(
    (): GuidePickupGeofenceContextValue => ({
      geofenceAuto,
      setGeofenceAutoPersist,
      layoutTrackingTourId: layoutState.trackingTourId,
      layoutGeofenceStatus: layoutState.status
    }),
    [geofenceAuto, setGeofenceAutoPersist, layoutState.trackingTourId, layoutState.status]
  )

  return (
    <GuidePickupGeofenceContext.Provider value={value}>
      <GuideAppPickupGeofenceRunner
        guideEmail={guideEmail}
        locale={locale}
        geofenceAuto={geofenceAuto}
        onLayoutState={onLayoutState}
      />
      {children}
    </GuidePickupGeofenceContext.Provider>
  )
}
