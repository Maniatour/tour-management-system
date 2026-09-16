'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  countUnreadAdminAlerts,
  markAdminAlertRead,
  markAllAdminAlertsRead,
  readAdminAlertInbox,
  sortAdminAlertInbox,
  upsertAdminAlertInbox,
  writeAdminAlertInbox,
  type AdminAlertInboxDraft,
  type AdminAlertInboxItem,
} from '@/lib/adminAlertInbox'

export type AdminAlertInboxContextValue = {
  items: AdminAlertInboxItem[]
  unreadCount: number
  upsert: (draft: AdminAlertInboxDraft) => void
  markRead: (id: string) => void
  markAllRead: () => void
}

const AdminAlertInboxContext = createContext<AdminAlertInboxContextValue | null>(null)

export function AdminAlertInboxProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AdminAlertInboxItem[]>(() => readAdminAlertInbox())

  useEffect(() => {
    writeAdminAlertInbox(items)
  }, [items])

  const upsert = useCallback((draft: AdminAlertInboxDraft) => {
    setItems((prev) => upsertAdminAlertInbox(prev, draft))
  }, [])

  const markRead = useCallback((id: string) => {
    setItems((prev) => markAdminAlertRead(prev, id))
  }, [])

  const markAllRead = useCallback(() => {
    setItems((prev) => markAllAdminAlertsRead(prev))
  }, [])

  const value = useMemo<AdminAlertInboxContextValue>(
    () => ({
      items: sortAdminAlertInbox(items),
      unreadCount: countUnreadAdminAlerts(items),
      upsert,
      markRead,
      markAllRead,
    }),
    [items, upsert, markRead, markAllRead]
  )

  return <AdminAlertInboxContext.Provider value={value}>{children}</AdminAlertInboxContext.Provider>
}

export function useAdminAlertInboxOptional(): AdminAlertInboxContextValue | null {
  return useContext(AdminAlertInboxContext)
}

export function useReportAdminAlert(): (draft: AdminAlertInboxDraft) => void {
  const ctx = useAdminAlertInboxOptional()
  const upsertRef = useRef(ctx?.upsert)
  upsertRef.current = ctx?.upsert
  return useCallback((draft: AdminAlertInboxDraft) => {
    upsertRef.current?.(draft)
  }, [])
}
