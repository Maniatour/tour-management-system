'use client'

import { useEffect, useRef } from 'react'
import { adminAlertKindLabel, type AdminAlertKind } from '@/lib/adminAlertInbox'

export type AdminNotificationKindTab = 'all' | AdminAlertKind

const KIND_ORDER: AdminAlertKind[] = [
  'customer_payment',
  'cash_withdrawal',
  'pricing_audit',
  'reservation_import',
  'google_review_import',
  'guest_resident_check',
  'guest_waiver_signed',
  'tour_chat',
  'staff_site_alert',
  'op_todo',
  'weather_reminder',
  'goblin_narration',
  'waiver_print_reminder',
  'competitor_price',
]

type AdminNotificationCenterKindTabsProps = {
  isKo: boolean
  active: AdminNotificationKindTab
  counts: Partial<Record<AdminAlertKind, number>>
  unreadCounts: Partial<Record<AdminAlertKind, number>>
  total: number
  unreadTotal: number
  onChange: (tab: AdminNotificationKindTab) => void
}

export function AdminNotificationCenterKindTabs({
  isKo,
  active,
  counts,
  unreadCounts,
  total,
  unreadTotal,
  onChange,
}: AdminNotificationCenterKindTabsProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null)
  const tabs: { id: AdminNotificationKindTab; label: string; count: number; unread: number }[] = [
    { id: 'all', label: isKo ? '전체' : 'All', count: total, unread: unreadTotal },
    ...KIND_ORDER.filter((kind) => (counts[kind] ?? 0) > 0).map((kind) => ({
      id: kind,
      label: adminAlertKindLabel(kind, isKo),
      count: counts[kind] ?? 0,
      unread: unreadCounts[kind] ?? 0,
    })),
  ]

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [active])

  return (
    <div
      role="tablist"
      aria-label={isKo ? '알림 종류' : 'Notification types'}
      className="flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 [scrollbar-width:thin]"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            ref={selected ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selected
                ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-sm'
                : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            {tab.label}
            <span className={`tabular-nums ${selected ? 'text-amber-700' : 'text-slate-400'}`}>{tab.count}</span>
            {tab.unread > 0 && tab.unread !== tab.count ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {tab.unread > 99 ? '99+' : tab.unread}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
