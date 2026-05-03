'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Mail, GripVertical, X } from 'lucide-react'

export const GMAIL_RESERVATION_SYNC_COMPLETE = 'gmail-reservation-sync-complete'
export const GMAIL_RESERVATION_SYNC_UNAUTHORIZED = 'gmail-reservation-sync-unauthorized'

type SyncPhase = 'idle' | 'syncing' | 'done' | 'error'

export type GmailReservationImportSyncDetail = {
  fullSync: boolean
  imported?: number
  total?: number
  queryUsed?: string
}

interface GmailReservationImportSyncContextValue {
  phase: SyncPhase
  fullSync: boolean
  isSyncing: boolean
  startGmailImportSync: (fullSync: boolean) => void
  dismissModal: () => void
}

const GmailReservationImportSyncContext = createContext<GmailReservationImportSyncContextValue | undefined>(
  undefined
)

const MODAL_W = 340
const MODAL_H = 200

export function GmailReservationImportSyncProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<SyncPhase>('idle')
  const [fullSync, setFullSync] = useState(false)
  const [resultLines, setResultLines] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const dragRef = useRef<{
    active: boolean
    startX: number
    startY: number
    origLeft: number
    origTop: number
  } | null>(null)
  const syncInFlightRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const initPosition = useCallback(() => {
    if (typeof window === 'undefined') return { left: 24, top: 24 }
    const left = Math.max(8, window.innerWidth - MODAL_W - 24)
    const top = Math.max(8, window.innerHeight - MODAL_H - 24)
    return { left, top }
  }, [])

  useEffect(() => {
    if (phase === 'idle' || pos !== null) return
    setPos(initPosition())
  }, [phase, pos, initPosition])

  useEffect(() => {
    if (phase === 'idle') return
    const onResize = () => {
      setPos((p) => {
        if (!p) return initPosition()
        const maxL = Math.max(8, window.innerWidth - MODAL_W - 8)
        const maxT = Math.max(8, window.innerHeight - 120)
        return {
          left: Math.min(Math.max(8, p.left), maxL),
          top: Math.min(Math.max(8, p.top), maxT),
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [phase, initPosition])

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      if (!pos) return
      e.preventDefault()
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: pos.left,
        origTop: pos.top,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [pos]
  )

  const onHeaderPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d?.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    let left = d.origLeft + dx
    let top = d.origTop + dy
    const maxL = Math.max(8, window.innerWidth - MODAL_W - 8)
    const maxT = Math.max(8, window.innerHeight - 120)
    left = Math.min(Math.max(8, left), maxL)
    top = Math.min(Math.max(8, top), maxT)
    setPos({ left, top })
  }, [])

  const onHeaderPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.active) {
      dragRef.current.active = false
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
    }
  }, [])

  const runSync = useCallback(async (full: boolean) => {
    setPhase('syncing')
    setFullSync(full)
    setResultLines([])
    setPos((p) => p ?? initPosition())

    try {
      const res = await fetch('/api/email/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullSync: full }),
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>

      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new Event(GMAIL_RESERVATION_SYNC_UNAUTHORIZED))
        }
        const err = typeof data?.error === 'string' ? data.error : res.statusText
        setResultLines([`동기화 실패: ${err}`])
        setPhase('error')
        return
      }

      const imported = typeof data.imported === 'number' ? data.imported : 0
      const total = typeof data.total === 'number' ? data.total : undefined
      const queryUsed = typeof data.queryUsed === 'string' ? data.queryUsed : undefined

      const msg = full
        ? `전체 재동기화 완료: ${queryUsed ?? 'after:날짜'} 검색, ${total ?? 0}건 중 새로 추가 ${imported}건.`
        : `동기화 완료: 새 메일 ${imported}건이 예약 가져오기 목록에 추가되었습니다.`

      setResultLines([msg])
      setPhase('done')

      const detail = {
        fullSync: full,
        imported,
        ...(typeof total === 'number' ? { total } : {}),
        ...(typeof queryUsed === 'string' ? { queryUsed } : {}),
      } satisfies GmailReservationImportSyncDetail
      window.dispatchEvent(new CustomEvent(GMAIL_RESERVATION_SYNC_COMPLETE, { detail }))
    } catch (e) {
      setResultLines([e instanceof Error ? e.message : '동기화 실패'])
      setPhase('error')
    }
  }, [initPosition])

  const startGmailImportSync = useCallback(
    (full: boolean) => {
      if (syncInFlightRef.current) return
      syncInFlightRef.current = true
      void runSync(full).finally(() => {
        syncInFlightRef.current = false
      })
    },
    [runSync]
  )

  const dismissModal = useCallback(() => {
    if (phase === 'syncing') return
    setPhase('idle')
    setResultLines([])
    setPos(null)
  }, [phase])

  const value = useMemo<GmailReservationImportSyncContextValue>(
    () => ({
      phase,
      fullSync,
      isSyncing: phase === 'syncing',
      startGmailImportSync,
      dismissModal,
    }),
    [phase, fullSync, startGmailImportSync, dismissModal]
  )

  const panel =
    phase !== 'idle' && pos ? (
      <div
        data-gmail-sync-panel
        role="dialog"
        aria-labelledby="gmail-sync-title"
        aria-live="polite"
        className="fixed z-[200] flex flex-col w-[min(340px,calc(100vw-16px))] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        style={{ left: pos.left, top: pos.top, maxHeight: 'min(420px, 85vh)' }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-200 cursor-grab active:cursor-grabbing select-none touch-manipulation"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <GripVertical className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
          <span id="gmail-sync-title" className="text-sm font-semibold text-slate-800 flex-1 min-w-0">
            예약 가져오기 · Gmail 동기화
          </span>
          {phase !== 'syncing' ? (
            <button
              type="button"
              onClick={dismissModal}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 touch-manipulation"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-[10px] text-slate-500 px-1 shrink-0">백그라운드 진행</span>
          )}
        </div>
        <div className="p-3 text-sm text-slate-700 space-y-2">
          {phase === 'syncing' && (
            <div className="flex items-start gap-2">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-medium text-slate-900">
                  {fullSync ? '전체 재동기화 중…' : '받은편지함 동기화 중…'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  다른 관리자 페이지로 이동해도 동기화는 계속됩니다. 창 제목 줄을 드래그해 위치를 옮길 수 있습니다.
                </p>
              </div>
            </div>
          )}
          {(phase === 'done' || phase === 'error') && (
            <div className="flex items-start gap-2">
              {phase === 'done' ? (
                <Mail className="w-5 h-5 text-green-600 shrink-0 mt-0.5" aria-hidden />
              ) : (
                <span className="text-lg leading-none shrink-0" aria-hidden>
                  ⚠
                </span>
              )}
              <div className="space-y-1 min-w-0">
                {resultLines.map((line, i) => (
                  <p key={i} className={phase === 'error' ? 'text-red-800' : 'text-slate-800'}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    ) : null

  return (
    <GmailReservationImportSyncContext.Provider value={value}>
      {children}
      {mounted && panel ? createPortal(panel, document.body) : null}
    </GmailReservationImportSyncContext.Provider>
  )
}

export function useGmailReservationImportSync() {
  const ctx = useContext(GmailReservationImportSyncContext)
  if (!ctx) {
    throw new Error('useGmailReservationImportSync must be used within GmailReservationImportSyncProvider')
  }
  return ctx
}
