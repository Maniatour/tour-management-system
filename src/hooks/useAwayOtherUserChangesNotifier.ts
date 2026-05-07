'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  AWAY_CHANGE_IDLE_MS_DEFAULT,
  fetchAwayChangeDigest,
  maxAwayChangeAtIso,
  type AwayChangeDigestScope,
  type AwayChangeItem,
} from '@/lib/awayChangeDigest'
import { useAuth } from '@/contexts/AuthContext'

type WatermarkStore = {
  get: () => string | null
  set: (iso: string) => void
}

function sessionWatermarkStore(storageKey: string): WatermarkStore {
  return {
    get: () => {
      try {
        return sessionStorage.getItem(storageKey)
      } catch {
        return null
      }
    },
    set: (iso: string) => {
      try {
        sessionStorage.setItem(storageKey, iso)
      } catch {
        /* ignore */
      }
    },
  }
}

function effectiveActorEmail(args: {
  isSimulating: boolean
  simulatedUserEmail: string | null | undefined
  authUserEmail: string | null | undefined
  userEmail: string | null | undefined
}): string | null {
  if (args.isSimulating && args.simulatedUserEmail) return args.simulatedUserEmail
  return args.authUserEmail || args.userEmail || null
}

export function useAwayOtherUserChangesNotifier(args: {
  supabase: SupabaseClient<Database>
  storageNamespace: string
  scope: AwayChangeDigestScope
  /** 예약·투어 digest: 감사 로그 SELECT 권한 (예: hasPermission(role, 'canViewAuditLogs')) */
  canQueryAuditLogs: boolean
  idleMs?: number
  enabled?: boolean
}) {
  const {
    supabase,
    storageNamespace,
    scope,
    canQueryAuditLogs,
    idleMs = AWAY_CHANGE_IDLE_MS_DEFAULT,
    enabled = true,
  } = args

  const { user, authUser, simulatedUser, isSimulating } = useAuth()
  const myEmail = effectiveActorEmail({
    isSimulating,
    simulatedUserEmail: simulatedUser?.email,
    authUserEmail: authUser?.email,
    userEmail: user?.email,
  })

  const watermarkKey = useMemo(() => {
    const em = (myEmail || '').trim().toLowerCase()
    if (!em) return ''
    return `away-changes:${em}:${storageNamespace}`
  }, [myEmail, storageNamespace])

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AwayChangeItem[]>([])
  const [loading, setLoading] = useState(false)

  const itemsRef = useRef<AwayChangeItem[]>([])
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const lastInputAtRef = useRef(Date.now())
  const hiddenAtRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const storeRef = useRef<WatermarkStore | null>(null)

  useEffect(() => {
    if (!enabled || !watermarkKey) {
      storeRef.current = null
      return
    }
    storeRef.current = sessionWatermarkStore(watermarkKey)
    const wm = storeRef.current.get()
    if (!wm) {
      storeRef.current.set(new Date().toISOString())
    }
  }, [enabled, watermarkKey])

  useEffect(() => {
    if (!enabled) return
    const opts: AddEventListenerOptions = { passive: true }
    const onInput = () => {
      lastInputAtRef.current = Date.now()
    }
    window.addEventListener('keydown', onInput, opts)
    window.addEventListener('mousedown', onInput, opts)
    window.addEventListener('wheel', onInput, opts)
    window.addEventListener('touchstart', onInput, opts)
    return () => {
      window.removeEventListener('keydown', onInput, opts)
      window.removeEventListener('mousedown', onInput, opts)
      window.removeEventListener('wheel', onInput, opts)
      window.removeEventListener('touchstart', onInput, opts)
    }
  }, [enabled])

  const runCheck = useCallback(async () => {
    if (!enabled || !myEmail || !storeRef.current) return
    if (inFlightRef.current) return
    const needsAudit = (scope.reservations || scope.tours) && canQueryAuditLogs
    const needsBooking = Boolean(scope.bookings)
    if (!needsAudit && !needsBooking) return

    const effectiveScope: AwayChangeDigestScope = {
      reservations: Boolean(needsAudit && scope.reservations),
      tours: Boolean(needsAudit && scope.tours),
      bookings: needsBooking,
    }
    if (!effectiveScope.reservations && !effectiveScope.tours && !effectiveScope.bookings) return

    const since = storeRef.current.get()
    if (!since) return

    inFlightRef.current = true
    setLoading(true)
    try {
      const next = await fetchAwayChangeDigest(supabase, {
        sinceIso: since,
        myEmail,
        scope: effectiveScope,
      })
      if (next.length > 0) {
        setItems(next)
        setOpen(true)
      }
    } catch (e) {
      console.warn('useAwayOtherUserChangesNotifier: fetch failed', e)
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [enabled, myEmail, supabase, scope, canQueryAuditLogs])

  const onResumeIfIdle = useCallback(() => {
    if (!enabled || document.visibilityState !== 'visible') return
    const now = Date.now()
    const hiddenAt = hiddenAtRef.current
    const hiddenMs = hiddenAt != null ? now - hiddenAt : 0
    const inactiveMs = now - lastInputAtRef.current
    if (hiddenMs >= idleMs && inactiveMs >= idleMs) {
      void runCheck()
    }
    hiddenAtRef.current = null
  }, [enabled, idleMs, runCheck])

  useEffect(() => {
    if (!enabled) return
    if (document.visibilityState === 'hidden') {
      hiddenAtRef.current = Date.now()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
      } else {
        window.setTimeout(() => onResumeIfIdle(), 120)
      }
    }
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        window.setTimeout(() => onResumeIfIdle(), 120)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, onResumeIfIdle])

  const dismiss = useCallback((markRead: boolean) => {
    const snapshot = itemsRef.current
    setOpen(false)
    setItems([])
    if (markRead && storeRef.current) {
      const iso = snapshot.length ? maxAwayChangeAtIso(snapshot) : new Date().toISOString()
      storeRef.current.set(iso)
    }
  }, [])

  return {
    open,
    items,
    loading,
    dismiss,
  }
}
