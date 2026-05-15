'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { Phone, X } from 'lucide-react'
import {
  getVoiceCallTabBroadcastChannel,
  type VoiceCallTabBroadcastPayload
} from '@/lib/voiceCallTabBroadcast'
import { playIncomingRingBeep } from '@/lib/voiceCallRing'

type ActiveIncoming = {
  roomId: string
  tourId: string
  callerName: string
  openPath: string
}

interface VoiceCallCrossTabListenerProps {
  locale: 'ko' | 'en'
}

/**
 * 채팅 탭이 아닌 다른 가이드 탭에서도 음성 통화 수신을 알림 (BroadcastChannel + 벨).
 * 실제 통화 수락은 채팅이 열린 탭에서만 가능합니다.
 */
export default function VoiceCallCrossTabListener({ locale }: VoiceCallCrossTabListenerProps) {
  const myTabId = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tab-${Date.now()}`
  )
  const [active, setActive] = useState<ActiveIncoming | null>(null)
  const ringCtxRef = useRef<AudioContext | null>(null)
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopCrossTabRing = useCallback(() => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current)
      ringIntervalRef.current = null
    }
    if (ringCtxRef.current) {
      const c = ringCtxRef.current
      ringCtxRef.current = null
      c.close().catch(() => {})
    }
  }, [])

  const startCrossTabRing = useCallback(() => {
    stopCrossTabRing()
    const AC =
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    if (!AC) return
    const ctx = new AC()
    ringCtxRef.current = ctx
    const tick = () => {
      if (ringCtxRef.current !== ctx || ctx.state === 'closed') return
      try {
        playIncomingRingBeep(ctx)
      } catch {
        /* ignore */
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([100, 60, 100])
        } catch {
          /* ignore */
        }
      }
    }
    void (async () => {
      try {
        await ctx.resume()
        tick()
        ringIntervalRef.current = setInterval(tick, 2600)
      } catch {
        stopCrossTabRing()
      }
    })()
  }, [stopCrossTabRing])

  useEffect(() => {
    const ch = getVoiceCallTabBroadcastChannel()
    if (!ch) return

    const onMessage = (ev: MessageEvent<VoiceCallTabBroadcastPayload>) => {
      const data = ev.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'dismiss') {
        setActive((cur) => (cur?.roomId === data.roomId ? null : cur))
        return
      }

      if (data.type === 'incoming') {
        if (data.fromTabId === myTabId.current) return
        setActive({
          roomId: data.roomId,
          tourId: data.tourId,
          callerName: data.callerName,
          openPath: data.openPath
        })
      }
    }

    ch.addEventListener('message', onMessage)
    return () => {
      ch.removeEventListener('message', onMessage)
    }
  }, [])

  useEffect(() => {
    if (!active) {
      stopCrossTabRing()
      return
    }
    startCrossTabRing()
    return () => {
      stopCrossTabRing()
    }
  }, [active, startCrossTabRing, stopCrossTabRing])

  const dismiss = () => {
    const roomId = active?.roomId
    setActive(null)
    stopCrossTabRing()
    if (roomId) {
      getVoiceCallTabBroadcastChannel()?.postMessage({ type: 'dismiss', roomId })
    }
  }

  if (!active) return null

  const t =
    locale === 'ko'
      ? {
          title: '음성 통화 요청',
          from: '에서 통화 요청이 왔습니다.',
          go: '투어 채팅으로 이동',
          close: '닫기'
        }
      : {
          title: 'Voice call request',
          from: 'is requesting a call.',
          go: 'Open tour chat',
          close: 'Dismiss'
        }

  return (
    <div
      className="fixed top-0 inset-x-0 z-[100] flex justify-center px-3 pt-3 pointer-events-none"
      role="alert"
      aria-live="assertive"
    >
      <div className="pointer-events-auto flex max-w-lg w-full items-center gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-lg">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <Phone className="h-5 w-5 animate-pulse" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{t.title}</p>
          <p className="truncate text-sm text-gray-600">
            <span className="font-medium text-gray-800">{active.callerName}</span> {t.from}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={active.openPath}
            onClick={() => dismiss()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            {t.go}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label={t.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
