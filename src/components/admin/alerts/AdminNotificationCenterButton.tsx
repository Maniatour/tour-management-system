'use client'

import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AdminNotificationCenterList } from '@/components/admin/alerts/AdminNotificationCenterList'
import { AdminAlertFallbackModal } from '@/components/admin/alerts/AdminAlertFallbackModal'
import { useAdminAlertInboxOptional } from '@/contexts/AdminAlertInboxContext'
import { dispatchAdminAlertReplay } from '@/lib/adminAlertReplay'
import type { AdminAlertInboxItem } from '@/lib/adminAlertInbox'

type AdminNotificationCenterButtonProps = {
  locale: string
}

export function AdminNotificationCenterButton({ locale }: AdminNotificationCenterButtonProps) {
  const inbox = useAdminAlertInboxOptional()
  const [open, setOpen] = useState(false)
  const [fallback, setFallback] = useState<AdminAlertInboxItem | null>(null)
  const isKo = locale.startsWith('ko')
  const unreadCount = inbox?.unreadCount ?? 0
  const title = isKo ? '알림' : 'Notifications'
  const description = isKo
    ? '사이트에 뜬 모달 알림을 한곳에서 다시 확인할 수 있습니다.'
    : 'Review modal alerts from this session in one place.'

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white transition-colors hover:bg-amber-600"
          title={title}
          aria-label={unreadCount > 0 ? `${title} (${unreadCount})` : title}
        >
          <Bell className="h-5 w-5" />
        </button>
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(86vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  {description}
                </DialogDescription>
              </div>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => inbox?.markAllRead()}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {isKo ? '모두 읽음' : 'Mark all read'}
                </button>
              ) : null}
            </div>
          </DialogHeader>
          <AdminNotificationCenterList
            locale={locale}
            onOpenModal={(item) => {
              inbox?.markRead(item.id)
              setOpen(false)
              window.setTimeout(() => {
                if (item.payload != null) {
                  dispatchAdminAlertReplay(item)
                  return
                }
                setFallback(item)
              }, 40)
            }}
          />
        </DialogContent>
      </Dialog>
      {fallback ? (
        <AdminAlertFallbackModal item={fallback} locale={locale} onClose={() => setFallback(null)} />
      ) : null}
    </>
  )
}
