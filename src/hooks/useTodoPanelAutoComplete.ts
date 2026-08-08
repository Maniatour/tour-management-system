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

/**
 * Empty queue → mark panel complete.
 * New work → reopen (live always; snapshot only when transitioning from empty).
 * Does not change panel-level 보류.
 *
 * Waits until `loading` has been true at least once while enabled, so the first
 * paint (loading=false, count=0 before fetch) does not false-complete the panel.
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
  const inFlightRef = useRef(false)
  const applyRef = useRef(applyCompleted)
  applyRef.current = applyCompleted

  useEffect(() => {
    if (!enabled) {
      sawLoadingRef.current = false
      prevWorkCountRef.current = null
      return
    }

    if (loading) {
      sawLoadingRef.current = true
      return
    }

    if (!sawLoadingRef.current || inFlightRef.current) return

    const prevWorkCount = prevWorkCountRef.current
    const next = resolveTodoPanelAutoComplete({
      workCount,
      completed,
      onHold,
      mode,
      prevWorkCount,
    })

    prevWorkCountRef.current = workCount

    if (next == null) return

    inFlightRef.current = true
    void Promise.resolve(applyRef.current(next)).finally(() => {
      inFlightRef.current = false
    })
  }, [enabled, loading, workCount, completed, onHold, mode])
}
