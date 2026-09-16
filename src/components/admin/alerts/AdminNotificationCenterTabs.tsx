'use client'

import type { AdminAlertInboxTab } from '@/lib/adminAlertInbox'

type AdminNotificationCenterTabsProps = {
  isKo: boolean
  tab: AdminAlertInboxTab
  unreadCount: number
  readCount: number
  onChange: (tab: AdminAlertInboxTab) => void
}

export function AdminNotificationCenterTabs({
  isKo,
  tab,
  unreadCount,
  readCount,
  onChange,
}: AdminNotificationCenterTabsProps) {
  const unreadLabel = isKo ? '안 읽음' : 'Unread'
  const readLabel = isKo ? '읽음' : 'Read'

  return (
    <div className="grid grid-cols-2 gap-1 border-b border-slate-200 bg-slate-50 p-2">
      <button
        type="button"
        onClick={() => onChange('unread')}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
          tab === 'unread' ? 'bg-white text-amber-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        {unreadLabel}
        <span className={`ml-1.5 tabular-nums ${tab === 'unread' ? 'text-amber-600' : 'text-slate-400'}`}>
          {unreadCount}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange('read')}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
          tab === 'read' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        {readLabel}
        <span className={`ml-1.5 tabular-nums ${tab === 'read' ? 'text-slate-700' : 'text-slate-400'}`}>
          {readCount}
        </span>
      </button>
    </div>
  )
}
