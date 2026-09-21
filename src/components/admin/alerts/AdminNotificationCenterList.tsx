'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  Cloud,
  CreditCard,
  FileSignature,
  FileText,
  Headphones,
  ListTodo,
  Mail,
  Megaphone,
  MessageCircle,
  Printer,
  Star,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { AdminNotificationCenterPagination } from '@/components/admin/alerts/AdminNotificationCenterPagination'
import { AdminNotificationCenterTabs } from '@/components/admin/alerts/AdminNotificationCenterTabs'
import { useAdminAlertInboxOptional } from '@/contexts/AdminAlertInboxContext'
import {
  ADMIN_ALERT_INBOX_PAGE_SIZE,
  adminAlertInboxPageCount,
  adminAlertKindLabel,
  clampAdminAlertInboxPage,
  countReadAdminAlerts,
  filterAdminAlertInboxByTab,
  formatAdminAlertTime,
  sliceAdminAlertInboxPage,
  type AdminAlertInboxItem,
  type AdminAlertInboxTab,
  type AdminAlertKind,
} from '@/lib/adminAlertInbox'

const KIND_ICON: Record<AdminAlertKind, LucideIcon> = {
  customer_payment: CreditCard,
  cash_withdrawal: Banknote,
  pricing_audit: AlertTriangle,
  reservation_import: Mail,
  google_review_import: Star,
  guest_resident_check: FileText,
  guest_waiver_signed: FileSignature,
  tour_chat: MessageCircle,
  staff_site_alert: Megaphone,
  op_todo: ListTodo,
  weather_reminder: Cloud,
  goblin_narration: Headphones,
  waiver_print_reminder: Printer,
  competitor_price: TrendingUp,
}

const KIND_TONE: Record<AdminAlertKind, string> = {
  customer_payment: 'bg-emerald-600',
  cash_withdrawal: 'bg-rose-600',
  pricing_audit: 'bg-amber-600',
  reservation_import: 'bg-sky-600',
  google_review_import: 'bg-yellow-500',
  guest_resident_check: 'bg-violet-600',
  guest_waiver_signed: 'bg-emerald-700',
  tour_chat: 'bg-blue-600',
  staff_site_alert: 'bg-violet-700',
  op_todo: 'bg-amber-500',
  weather_reminder: 'bg-sky-500',
  goblin_narration: 'bg-indigo-600',
  waiver_print_reminder: 'bg-amber-700',
  competitor_price: 'bg-blue-700',
}

type AdminNotificationCenterListProps = {
  locale: string
  onOpenModal: (item: AdminAlertInboxItem) => void
}

export function AdminNotificationCenterList({ locale, onOpenModal }: AdminNotificationCenterListProps) {
  const inbox = useAdminAlertInboxOptional()
  const isKo = locale.startsWith('ko')
  const items = inbox?.items ?? []
  const [tab, setTab] = useState<AdminAlertInboxTab>('unread')
  const [pageState, setPageState] = useState(1)
  const tabItems = filterAdminAlertInboxByTab(items, tab)
  const page = clampAdminAlertInboxPage(pageState, tabItems.length)
  const totalPages = adminAlertInboxPageCount(tabItems.length)
  const pageItems = sliceAdminAlertInboxPage(tabItems, page)
  const rangeStart = tabItems.length === 0 ? 0 : (page - 1) * ADMIN_ALERT_INBOX_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * ADMIN_ALERT_INBOX_PAGE_SIZE, tabItems.length)
  const unreadCount = inbox?.unreadCount ?? 0
  const readCount = countReadAdminAlerts(items)
  const openLabel = isKo ? '알림 모달 열기' : 'Open alert modal'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AdminNotificationCenterTabs
        isKo={isKo}
        tab={tab}
        unreadCount={unreadCount}
        readCount={readCount}
        onChange={(next) => {
          setTab(next)
          setPageState(1)
        }}
      />

      {tabItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm font-medium text-gray-900">
            {tab === 'unread'
              ? isKo
                ? '안 읽은 알림이 없습니다'
                : 'No unread alerts'
              : isKo
                ? '읽은 알림이 없습니다'
                : 'No read alerts'}
          </p>
        </div>
      ) : (
        <>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {pageItems.map((item, index) => {
              const Icon = KIND_ICON[item.kind]
              return (
                <li
                  key={item.id}
                  className={index < pageItems.length - 1 ? 'border-b border-slate-200' : undefined}
                >
                  <div
                    className={`flex items-start gap-3 border-l-4 px-4 py-3.5 ${
                      item.read ? 'border-l-slate-200 bg-slate-50' : 'border-l-amber-500 bg-amber-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenModal(item)}
                      title={openLabel}
                      aria-label={openLabel}
                      className={`relative mt-0.5 shrink-0 rounded-lg p-2.5 text-white shadow-sm ring-2 ring-offset-2 transition hover:brightness-110 ${KIND_TONE[item.kind]} ${
                        item.read ? 'ring-transparent ring-offset-slate-50' : 'ring-amber-300 ring-offset-amber-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => inbox?.markRead(item.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            item.read ? 'bg-slate-200 text-slate-500' : 'bg-amber-500 text-white'
                          }`}
                        >
                          {item.read ? (isKo ? '읽음' : 'Read') : isKo ? '안 읽음' : 'Unread'}
                        </span>
                        <span
                          className={`text-[11px] font-medium uppercase tracking-wide ${
                            item.read ? 'text-slate-400' : 'text-amber-800'
                          }`}
                        >
                          {adminAlertKindLabel(item.kind, isKo)}
                        </span>
                        <span className={`ml-auto shrink-0 text-[11px] ${item.read ? 'text-slate-400' : 'text-slate-600'}`}>
                          {formatAdminAlertTime(item.createdAt, locale)}
                        </span>
                      </span>
                      <span
                        className={`mt-1 block truncate text-sm ${
                          item.read ? 'font-medium text-slate-500' : 'font-semibold text-slate-900'
                        }`}
                      >
                        {item.title}
                      </span>
                      <span
                        className={`mt-0.5 line-clamp-2 block text-sm ${item.read ? 'text-slate-400' : 'text-slate-700'}`}
                      >
                        {item.body}
                      </span>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <AdminNotificationCenterPagination
            isKo={isKo}
            page={page}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={tabItems.length}
            onPrev={() => setPageState(page - 1)}
            onNext={() => setPageState(page + 1)}
          />
        </>
      )}
    </div>
  )
}
