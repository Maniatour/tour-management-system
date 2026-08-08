'use client'

import { useEffect, useRef } from 'react'
import {
  resolveTodoPanelAutoComplete,
  type TodoPanelAutoCompleteMode,
} from '@/lib/todoPanelAutoComplete'

type UseTodoPanelAutoCompleteOptions = {
  enabled?: boolean
  loading: boolean
  /** Actionable remaining work. 0 = nothing to do. */
  workCount: number
  completed: boolean
  onHold?: boolean
  mode: TodoPanelAutoCompleteMode
  /** Must set absolute completed state (localStorage / linked todo / parent). */
  applyCompleted: (next: boolean) => void | Promise<void>
}

const DEBOUNCE_MS = 500

/**
 * Empty queue → mark panel complete.
 * New work (empty → nonempty) → reopen.
 * Live panels also reopen once on first stable load if completed while work exists.
 * Does not change panel-level 보류.
 *
 * Debounced so brief loading/count blips do not flip tabs repeatedly.
 */
export function useTodoPanelAutoComplete({
  enabled = true,
  loading,
  workCount,
  completed,
  onHold = false,
  mode,
  applyCompleted,
}: UseTodoPanelAutoCompleteOptions): void {
  const prevWorkCountRef = useRef<number | null>(null)
  const sawLoadingRef = useRef(false)
  const initialReconcileDoneRef = useRef(false)
  const inFlightRef = useRef(false)
  const lastAppliedRef = useRef<boolean | null>(null)
  const applyRef = useRef(applyCompleted)
  applyRef.current = applyCompleted

  const workCountRef = useRef(workCount)
  const completedRef = useRef(completed)
  const onHoldRef = useRef(onHold)
  const modeRef = useRef(mode)
  workCountRef.current = workCount
  completedRef.current = completed
  onHoldRef.current = onHold
  modeRef.current = mode

  useEffect(() => {
    if (!enabled) {
      sawLoadingRef.current = false
      prevWorkCountRef.current = null
      initialReconcileDoneRef.current = false
      lastAppliedRef.current = null
      return
    }

    if (loading) {
      sawLoadingRef.current = true
      return
    }

    if (!sawLoadingRef.current || inFlightRef.current) return

    const timer = window.setTimeout(() => {
      if (inFlightRef.current) return

      const currentCount = workCountRef.current
      const currentCompleted = completedRef.current
      const isInitial = !initialReconcileDoneRef.current
      initialReconcileDoneRef.current = true

      const next = resolveTodoPanelAutoComplete({
        workCount: currentCount,
        completed: currentCompleted,
        onHold: onHoldRef.current,
        mode: modeRef.current,
        prevWorkCount: prevWorkCountRef.current,
        initialReconcile: isInitial,
      })

      prevWorkCountRef.current = currentCount

      if (next == null) return
      if (lastAppliedRef.current === next && next === currentCompleted) return

      lastAppliedRef.current = next
      inFlightRef.current = true
      void Promise.resolve(applyRef.current(next)).finally(() => {
        inFlightRef.current = false
      })
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [enabled, loading, workCount, completed, onHold, mode])
}
