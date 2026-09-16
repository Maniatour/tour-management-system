'use client'

import { useEffect, useRef } from 'react'
import {
  ADMIN_ALERT_REPLAY_EVENT,
  isAdminAlertReplayKind,
} from '@/lib/adminAlertReplay'
import type { AdminAlertInboxItem, AdminAlertKind } from '@/lib/adminAlertInbox'

export function useAdminAlertReplay(
  kind: AdminAlertKind,
  onReplay: (item: AdminAlertInboxItem) => void
): void {
  const onReplayRef = useRef(onReplay)
  onReplayRef.current = onReplay

  useEffect(() => {
    const handler = (event: Event) => {
      const item = (event as CustomEvent<AdminAlertInboxItem>).detail
      if (!item || !isAdminAlertReplayKind(item, kind)) return
      onReplayRef.current(item)
    }
    window.addEventListener(ADMIN_ALERT_REPLAY_EVENT, handler)
    return () => window.removeEventListener(ADMIN_ALERT_REPLAY_EVENT, handler)
  }, [kind])
}
