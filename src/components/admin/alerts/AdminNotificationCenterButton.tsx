'use client'

import { Bell, CheckCheck, GripVertical } from 'lucide-react'
import { useEffect, useState, type MutableRefObject } from 'react'
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
import { useAdminNotificationPanelFrame } from '@/components/admin/alerts/useAdminNotificationPanelFrame'
import { dispatchAdminAlertReplay } from '@/lib/adminAlertReplay'
import type { AdminAlertInboxItem } from '@/lib/adminAlertInbox'

type AdminNotificationCenterButtonProps = {
  locale: string
  registerOpen?: MutableRefObject<(() => void) | null>
}

export function AdminNotificationCenterButton({ locale, registerOpen }: AdminNotificationCenterButtonProps) {
  const inbox = useAdminAlertInboxOptional()
  const [open, setOpen] = useState(false)
  const [fallback, setFallback] = useState<AdminAlertInboxItem | null>(null)
  const isKo = locale.startsWith('ko')
  const unreadCount = inbox?.unreadCount ?? 0
  const { box, beginDrag } = useAdminNotificationPanelFrame(open)
  useEffect(() => {
    if (!registerOpen) return
    registerOpen.current = () => setOpen(true)
    return () => {
      registerOpen.current = null
    }
  }, [registerOpen])

  const title = isKo ? '알림' : 'Notifications'
  const description = isKo
    ? '종류별로 모아 볼 수 있습니다. 제목을 끌어 옮기고, 가장자리로 크기를 조절하세요.'
    : 'Browse alerts by type. Drag the title to move, and the edges to resize.'

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
        <DialogContent
          style={
            box
              ? {
                  left: box.x,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: 'none',
                }
              : undefined
          }
          className="!fixed !flex !max-h-none !max-w-none !animate-none !transition-none flex-col !gap-0 overflow-hidden !p-0 sm:rounded-2xl"
        >
          <DialogHeader
            className="shrink-0 cursor-grab touch-none select-none border-b border-border/60 px-5 py-4 text-left active:cursor-grabbing"
            onPointerDown={(event) => beginDrag('move', event)}
          >
            <div className="flex items-start justify-between gap-3 pr-8">
              <div
                role="button"
                tabIndex={0}
                aria-label={isKo ? '알림 창 끌어서 이동' : 'Drag to move notifications'}
                className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                onPointerDown={(event) => beginDrag('move', event)}
              >
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  {title}
                </DialogTitle>
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
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={isKo ? '너비 조절' : 'Resize width'}
            tabIndex={0}
            className="absolute bottom-3 right-0 top-16 z-20 w-2 cursor-ew-resize touch-none"
            onPointerDown={(event) => beginDrag('e', event)}
          />
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={isKo ? '높이 조절' : 'Resize height'}
            tabIndex={0}
            className="absolute bottom-0 left-3 right-3 z-20 h-2 cursor-ns-resize touch-none"
            onPointerDown={(event) => beginDrag('s', event)}
          />
          <div
            role="separator"
            aria-label={isKo ? '모달 크기 조절' : 'Resize panel'}
            title={isKo ? '모달 크기 조절' : 'Resize panel'}
            tabIndex={0}
            className="absolute bottom-0 right-0 z-30 h-5 w-5 cursor-nwse-resize touch-none"
            onPointerDown={(event) => beginDrag('se', event)}
          >
            <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b-2 border-r-2 border-slate-400" />
          </div>
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
