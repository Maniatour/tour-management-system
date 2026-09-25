'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  Bus,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  FileBarChart,
  Headphones,
  LayoutGrid,
  ListTodo,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  MonitorSmartphone,
  Plus,
  Send,
  Smartphone,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminAlertInboxOptional } from '@/contexts/AdminAlertInboxContext'
import { canSendStaffSiteAlert } from '@/lib/staffSiteAlert'

const PriceInventoryHeaderButton = dynamic(() => import('@/components/schedule/PriceInventoryHeaderButton'), {
  ssr: false,
})
const QuickPaymentHeaderButton = dynamic(() => import('@/components/schedule/QuickPaymentHeaderButton'), {
  ssr: false,
})
const AdminSmsManagementHeaderButton = dynamic(
  () =>
    import('@/components/admin/sms/AdminSmsManagementHeaderButton').then((m) => ({
      default: m.AdminSmsManagementHeaderButton,
    })),
  { ssr: false },
)
const StaffSiteAlertHeaderButton = dynamic(
  () =>
    import('@/components/admin/staff-site-alert/StaffSiteAlertHeaderButton').then((m) => ({
      default: m.StaffSiteAlertHeaderButton,
    })),
  { ssr: false },
)

const QUICK_TILE: Record<string, { icon: LucideIcon; tile: string }> = {
  'hq-consultation': { icon: Headphones, tile: 'border-purple-200 bg-purple-50 text-purple-700' },
  'hq-customers': { icon: Users, tile: 'border-teal-200 bg-teal-50 text-teal-700' },
  'hq-reservations': { icon: CalendarCheck, tile: 'border-blue-200 bg-blue-50 text-blue-700' },
  'hq-booking': { icon: Ticket, tile: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  'hq-tours': { icon: Bus, tile: 'border-green-200 bg-green-50 text-green-700' },
  'hq-chat-management': { icon: MessagesSquare, tile: 'border-purple-200 bg-purple-50 text-purple-700' },
}

type QuickEntry = { id: string; href: string; label: string }

type AdminHeaderMobileAppsProps = {
  locale: string
  quickEntries: QuickEntry[]
  showAddReservation: boolean
  showPriceInventory: boolean
  showStaffTools: boolean
  showDailyReport: boolean
  showNotifications: boolean
  onOpenDailyReport: () => void
  onOpenNotifications: () => void
  tourChatUnreadCount: number
  teamBoardCount: number
  teamChatUnreadCount: number
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function AppTile({
  label,
  tileClass,
  badge,
  onClick,
  children,
}: {
  label: string
  tileClass: string
  badge?: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 active:scale-[0.98]"
    >
      <span className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm ${tileClass}`}>
        {children}
        <CountBadge count={badge ?? 0} />
      </span>
      <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-gray-800">{label}</span>
    </button>
  )
}

export default function AdminHeaderMobileApps({
  locale,
  quickEntries,
  showAddReservation,
  showPriceInventory,
  showStaffTools,
  showDailyReport,
  showNotifications,
  onOpenDailyReport,
  onOpenNotifications,
  tourChatUnreadCount,
  teamBoardCount,
  teamChatUnreadCount,
}: AdminHeaderMobileAppsProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { authUser, userRole, userPosition } = useAuth()
  const notificationUnreadCount = useAdminAlertInboxOptional()?.unreadCount ?? 0
  const [open, setOpen] = useState(false)
  const priceOpenRef = useRef<(() => void) | null>(null)
  const paymentOpenRef = useRef<(() => void) | null>(null)
  const smsOpenRef = useRef<(() => void) | null>(null)
  const alertOpenRef = useRef<(() => void) | null>(null)
  const isKo = locale.startsWith('ko')
  const canAlert = canSendStaffSiteAlert({
    userRole,
    userPosition,
    authUserEmail: authUser?.email,
  })

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const close = () => setOpen(false)
  const run = (action: (() => void) | null) => {
    action?.()
    close()
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
          open ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'
        }`}
        aria-expanded={open}
        aria-label={
          showNotifications && notificationUnreadCount > 0
            ? isKo
              ? `헤더 바로가기, 알림 ${notificationUnreadCount}`
              : `Header shortcuts, ${notificationUnreadCount} notifications`
            : isKo
              ? '헤더 바로가기'
              : 'Header shortcuts'
        }
        onClick={() => setOpen((value) => !value)}
      >
        <LayoutGrid className="h-5 w-5" />
        {showNotifications ? <CountBadge count={notificationUnreadCount} /> : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 top-[var(--header-height)] z-[9998] bg-black/40"
            aria-label={isKo ? '바로가기 닫기' : 'Close shortcuts'}
            onClick={close}
          />
          <div className="fixed inset-x-0 top-[var(--header-height)] z-[10000] max-h-[min(72dvh,34rem)] overflow-y-auto border-b border-gray-200 bg-gray-50 px-4 py-4 shadow-xl">
            <p className="mb-3 text-xs font-medium text-gray-500">{isKo ? '바로가기' : 'Shortcuts'}</p>
            <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6">
              {showNotifications ? (
                <AppTile
                  label={isKo ? '알림' : 'Alerts'}
                  tileClass="border-amber-200 bg-amber-50 text-amber-700"
                  badge={notificationUnreadCount}
                  onClick={() => run(onOpenNotifications)}
                >
                  <Bell className="h-6 w-6" />
                </AppTile>
              ) : null}
              {showDailyReport ? (
                <AppTile
                  label={isKo ? '일일 보고' : 'Daily Report'}
                  tileClass="border-slate-300 bg-slate-800 text-white"
                  onClick={() => run(onOpenDailyReport)}
                >
                  <FileBarChart className="h-6 w-6" />
                </AppTile>
              ) : null}
              {quickEntries.map((entry) => {
                const tile = QUICK_TILE[entry.id] ?? {
                  icon: LayoutGrid,
                  tile: 'border-gray-200 bg-white text-gray-700',
                }
                const Icon = tile.icon
                const badge = entry.id === 'hq-chat-management' ? tourChatUnreadCount : 0
                return (
                  <Link
                    key={entry.id}
                    href={entry.href}
                    onClick={close}
                    className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 active:scale-[0.98]"
                  >
                    <span className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm ${tile.tile}`}>
                      <Icon className="h-6 w-6" />
                      <CountBadge count={badge} />
                    </span>
                    <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-gray-800">
                      {entry.label}
                    </span>
                  </Link>
                )
              })}
              {showAddReservation ? (
                <AppTile
                  label={isKo ? '새 예약' : 'New booking'}
                  tileClass="border-blue-200 bg-blue-50 text-blue-700"
                  onClick={() => {
                    close()
                    router.push(`/${locale}/admin/reservations?add=true`)
                  }}
                >
                  <Plus className="h-6 w-6" />
                </AppTile>
              ) : null}
              {showPriceInventory ? (
                <>
                  <AppTile
                    label={isKo ? '가격·재고' : 'Price'}
                    tileClass="border-sky-200 bg-sky-50 text-sky-700"
                    onClick={() => run(priceOpenRef.current)}
                  >
                    <DollarSign className="h-6 w-6" />
                  </AppTile>
                  <AppTile
                    label={isKo ? '스케줄' : 'Schedule'}
                    tileClass="border-slate-200 bg-slate-50 text-slate-800"
                    onClick={() => {
                      close()
                      router.push(`/${locale}/admin/schedule-display`)
                    }}
                  >
                    <MonitorSmartphone className="h-6 w-6" />
                  </AppTile>
                  <AppTile
                    label={isKo ? '금액 청구' : 'Charge'}
                    tileClass="border-teal-200 bg-teal-50 text-teal-700"
                    onClick={() => run(paymentOpenRef.current)}
                  >
                    <Send className="h-6 w-6" />
                  </AppTile>
                </>
              ) : null}
              {showStaffTools ? (
                <>
                  <div className="contents sm:hidden">
                    <AppTile
                      label="SMS"
                      tileClass="border-violet-200 bg-violet-50 text-violet-700"
                      onClick={() => run(smsOpenRef.current)}
                    >
                      <Smartphone className="h-6 w-6" />
                    </AppTile>
                    <Link
                      href={`/${locale}/admin/operations-hub`}
                      onClick={close}
                      className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 active:scale-[0.98]"
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm">
                        <ClipboardList className="h-6 w-6" />
                      </span>
                      <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-gray-800">
                        {isKo ? '운영 허브' : 'Hub'}
                      </span>
                    </Link>
                    <Link
                      href={`/${locale}/admin/team-board`}
                      onClick={close}
                      className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 active:scale-[0.98]"
                    >
                      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 shadow-sm">
                        <ListTodo className="h-6 w-6" />
                        <CountBadge count={teamBoardCount} />
                      </span>
                      <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-gray-800">
                        {isKo ? '팀 보드' : 'Board'}
                      </span>
                    </Link>
                    <Link
                      href={`/${locale}/admin/team-chat`}
                      onClick={close}
                      className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 active:scale-[0.98]"
                    >
                      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-green-200 bg-green-50 text-green-700 shadow-sm">
                        <MessageCircle className="h-6 w-6" />
                        <CountBadge count={teamChatUnreadCount} />
                      </span>
                      <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-gray-800">
                        {isKo ? '팀 채팅' : 'Team chat'}
                      </span>
                    </Link>
                    {canAlert ? (
                      <AppTile
                        label={isKo ? '사이트 알림' : 'Alert'}
                        tileClass="border-violet-200 bg-violet-50 text-violet-700"
                        onClick={() => run(alertOpenRef.current)}
                      >
                        <Megaphone className="h-6 w-6" />
                      </AppTile>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <div className="absolute h-0 w-0 overflow-visible">
        {showPriceInventory ? (
          <>
            <PriceInventoryHeaderButton className="sr-only" registerOpen={priceOpenRef} />
            <QuickPaymentHeaderButton locale={locale} className="sr-only" registerOpen={paymentOpenRef} />
          </>
        ) : null}
        {showStaffTools ? (
          <>
            <AdminSmsManagementHeaderButton locale={locale} className="sr-only" registerOpen={smsOpenRef} />
            <StaffSiteAlertHeaderButton locale={locale} hostOnly registerOpen={alertOpenRef} />
          </>
        ) : null}
      </div>
    </div>
  )
}
