'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Ban,
  CheckCircle2,
  CircleDashed,
  HelpCircle,
  Hourglass,
  Loader,
  OctagonX,
  PauseCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  TimerOff,
  UserX,
  XCircle,
} from 'lucide-react'

const iconWrap = 'inline-flex shrink-0 items-center justify-center'

export function TicketBookingBookingStatusIcon({
  status,
  className = 'h-3 w-3',
  title,
}: {
  status: string | null | undefined
  className?: string
  title?: string
}) {
  const s = (status ?? 'requested').trim().toLowerCase()
  let Icon: LucideIcon = CircleDashed
  switch (s) {
    case 'requested':
      Icon = Send
      break
    case 'on_hold':
      Icon = PauseCircle
      break
    case 'tentative':
      Icon = HelpCircle
      break
    case 'confirmed':
      Icon = CheckCircle2
      break
    case 'cancel_requested':
      Icon = ShieldAlert
      break
    case 'cancelled':
      Icon = XCircle
      break
    case 'no_show':
      Icon = UserX
      break
    case 'failed':
      Icon = OctagonX
      break
    case 'expired':
      Icon = TimerOff
      break
    default:
      Icon = CircleDashed
      break
  }
  return (
    <span className={iconWrap} title={title}>
      <Icon className={className} strokeWidth={2.25} aria-hidden />
    </span>
  )
}

export function TicketBookingVendorStatusIcon({
  status,
  className = 'h-3 w-3',
  title,
}: {
  status: string | null | undefined
  className?: string
  title?: string
}) {
  const s = (status ?? 'pending').trim().toLowerCase()
  let Icon: LucideIcon = Hourglass
  switch (s) {
    case 'pending':
      Icon = Hourglass
      break
    case 'confirmed':
      Icon = CheckCircle2
      break
    case 'rejected':
      Icon = XCircle
      break
    case 'changed':
      Icon = RefreshCw
      break
    case 'cancelled':
      Icon = Ban
      break
    default:
      Icon = Loader
      break
  }
  return (
    <span className={iconWrap} title={title}>
      <Icon className={className} strokeWidth={2.25} aria-hidden />
    </span>
  )
}
