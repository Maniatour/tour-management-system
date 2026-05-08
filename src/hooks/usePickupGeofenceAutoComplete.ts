'use client'

import { useEffect, useRef, useState } from 'react'
import { haversineDistanceMeters } from '@/lib/geo'

export type PickupGeofenceStatus = {
  watching: boolean
  distanceM: number | null
  accuracyM: number | null
  error: string | null
  dwellRemainingSec: number | null
}

interface UsePickupGeofenceAutoCompleteParams {
  enabled: boolean
  nextStopIndex: number
  targetLat: number | null
  targetLng: number | null
  onAutoComplete: () => Promise<void>
  /** 호텔 반경(미터). 픽업장·도로 오인 방지에 영향 */
  radiusMeters?: number
  /** 반경 안에 머문 시간(밀리초) — 짧은 통과 오감지 완화 */
  dwellMs?: number
  /** 이 배율을 넘어 나가면 체류 타이머 리셋 */
  exitHysteresis?: number
}

/**
 * 브라우저 Geolocation watchPosition 기반 지오펜스.
 * 탭이 백그라운드이면 OS/브라우저가 업데이트를 줄일 수 있음(웹 한계).
 */
export function usePickupGeofenceAutoComplete({
  enabled,
  nextStopIndex,
  targetLat,
  targetLng,
  onAutoComplete,
  radiusMeters = 140,
  dwellMs = 45000,
  exitHysteresis = 1.28
}: UsePickupGeofenceAutoCompleteParams): PickupGeofenceStatus {
  const [status, setStatus] = useState<PickupGeofenceStatus>({
    watching: false,
    distanceM: null,
    accuracyM: null,
    error: null,
    dwellRemainingSec: null
  })

  const watchIdRef = useRef<number | null>(null)
  const insideSinceRef = useRef<number | null>(null)
  const processingRef = useRef(false)
  /** 같은 nextStopIndex에서 watch 콜백이 연속으로 들어와 중복 전송되는 것 방지 */
  const lastFiredForIndexRef = useRef<number | null>(null)
  const onAutoCompleteRef = useRef(onAutoComplete)
  onAutoCompleteRef.current = onAutoComplete

  useEffect(() => {
    insideSinceRef.current = null
    lastFiredForIndexRef.current = null
  }, [nextStopIndex, targetLat, targetLng])

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (enabled) {
        setStatus({
          watching: false,
          distanceM: null,
          accuracyM: null,
          error: 'no_geolocation',
          dwellRemainingSec: null
        })
      }
      return
    }

    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    if (!enabled || targetLat == null || targetLng == null) {
      setStatus({
        watching: false,
        distanceM: null,
        accuracyM: null,
        error: null,
        dwellRemainingSec: null
      })
      return
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        const d = haversineDistanceMeters(latitude, longitude, targetLat, targetLng)
        const now = Date.now()
        const exitR = radiusMeters * exitHysteresis

        let dwellRemainingSec: number | null = null
        if (d <= radiusMeters) {
          if (insideSinceRef.current == null) insideSinceRef.current = now
          const elapsed = now - insideSinceRef.current
          dwellRemainingSec = Math.max(0, Math.ceil((dwellMs - elapsed) / 1000))

          if (
            !processingRef.current &&
            elapsed >= dwellMs &&
            lastFiredForIndexRef.current !== nextStopIndex
          ) {
            processingRef.current = true
            insideSinceRef.current = null
            lastFiredForIndexRef.current = nextStopIndex
            void (async () => {
              try {
                await onAutoCompleteRef.current()
              } catch (e) {
                console.error('pickup geofence onAutoComplete', e)
                lastFiredForIndexRef.current = null
              } finally {
                processingRef.current = false
              }
            })()
          }
        } else if (d >= exitR) {
          insideSinceRef.current = null
        }

        setStatus({
          watching: true,
          distanceM: Math.round(d),
          accuracyM: accuracy != null && Number.isFinite(accuracy) ? Math.round(accuracy) : null,
          error: null,
          dwellRemainingSec: d <= radiusMeters ? dwellRemainingSec : null
        })
      },
      (err) => {
        let code: string = 'unknown'
        if (err.code === err.PERMISSION_DENIED) code = 'denied'
        else if (err.code === err.POSITION_UNAVAILABLE) code = 'unavailable'
        else if (err.code === err.TIMEOUT) code = 'timeout'
        setStatus({
          watching: true,
          distanceM: null,
          accuracyM: null,
          error: code,
          dwellRemainingSec: null
        })
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 25000 }
    )

    watchIdRef.current = id
    setStatus((s) => ({ ...s, watching: true, error: null }))

    return () => {
      navigator.geolocation.clearWatch(id)
      watchIdRef.current = null
    }
  }, [enabled, nextStopIndex, targetLat, targetLng, radiusMeters, dwellMs, exitHysteresis])

  return status
}
