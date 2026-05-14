'use client'

import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarX2,
  Check,
  Ellipsis,
  Flag,
  Hourglass,
  LogOut,
  Minus,
  Pause,
  Send,
  Slash,
  Sparkles,
  X,
} from 'lucide-react'

export type TicketBookingAxisIconVariant = 'line' | 'tile'

const iconWrap = 'inline-flex shrink-0 items-center justify-center'

function bookingTileMeta(sNorm: string): { Icon: LucideIcon; bg: string } {
  switch (sNorm) {
    case 'requested':
      return { Icon: Send, bg: 'bg-amber-500' }
    case 'on_hold':
      return { Icon: Pause, bg: 'bg-sky-500' }
    case 'tentative':
      return { Icon: Sparkles, bg: 'bg-amber-500' }
    case 'confirmed':
      return { Icon: Check, bg: 'bg-emerald-500' }
    case 'cancel_requested':
      return { Icon: Flag, bg: 'bg-orange-500' }
    case 'cancelled':
      return { Icon: X, bg: 'bg-red-600' }
    case 'no_show':
      return { Icon: LogOut, bg: 'bg-slate-700' }
    case 'failed':
      return { Icon: AlertTriangle, bg: 'bg-rose-600' }
    case 'expired':
      return { Icon: CalendarX2, bg: 'bg-slate-500' }
    default:
      return { Icon: Ellipsis, bg: 'bg-slate-500' }
  }
}

function bookingLineIcon(sNorm: string): LucideIcon {
  switch (sNorm) {
    case 'requested':
      return Send
    case 'on_hold':
      return Pause
    case 'tentative':
      return Sparkles
    case 'confirmed':
      return Check
    case 'cancel_requested':
      return Flag
    case 'cancelled':
      return X
    case 'no_show':
      return LogOut
    case 'failed':
      return AlertTriangle
    case 'expired':
      return CalendarX2
    default:
      return Ellipsis
  }
}

function vendorTileMeta(sNorm: string): { Icon: LucideIcon; bg: string } {
  switch (sNorm) {
    case 'pending':
      return { Icon: Hourglass, bg: 'bg-amber-500' }
    case 'confirmed':
      return { Icon: Check, bg: 'bg-emerald-500' }
    case 'rejected':
      return { Icon: X, bg: 'bg-red-600' }
    case 'changed':
      return { Icon: ArrowRightLeft, bg: 'bg-indigo-500' }
    case 'cancelled':
      return { Icon: Slash, bg: 'bg-slate-600' }
    default:
      return { Icon: Ellipsis, bg: 'bg-slate-500' }
  }
}

function vendorLineIcon(sNorm: string): LucideIcon {
  switch (sNorm) {
    case 'pending':
      return Hourglass
    case 'confirmed':
      return Check
    case 'rejected':
      return X
    case 'changed':
      return ArrowRightLeft
    case 'cancelled':
      return Minus
    default:
      return Ellipsis
  }
}

export function TicketBookingBookingStatusIcon({
  status,
  className = 'h-3 w-3',
  title,
  variant = 'line',
}: {
  status: string | null | undefined
  className?: string
  title?: string
  variant?: TicketBookingAxisIconVariant
}) {
  const sNorm = (status ?? 'requested').trim().toLowerCase()

  if (variant === 'tile') {
    const { Icon, bg } = bookingTileMeta(sNorm)
    return (
      <span className={iconWrap} title={title}>
        <span
          className={`inline-flex items-center justify-center rounded-md shadow-sm ring-1 ring-black/15 ${bg} ${className}`}
        >
          <Icon className="h-[62%] w-[62%] text-white" strokeWidth={2.6} aria-hidden />
        </span>
      </span>
    )
  }

  const Icon = bookingLineIcon(sNorm)
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
  variant = 'line',
}: {
  status: string | null | undefined
  className?: string
  title?: string
  variant?: TicketBookingAxisIconVariant
}) {
  const sNorm = (status ?? 'pending').trim().toLowerCase()

  if (variant === 'tile') {
    const { Icon, bg } = vendorTileMeta(sNorm)
    return (
      <span className={iconWrap} title={title}>
        <span
          className={`inline-flex items-center justify-center rounded-md shadow-sm ring-1 ring-black/15 ${bg} ${className}`}
        >
          <Icon className="h-[62%] w-[62%] text-white" strokeWidth={2.6} aria-hidden />
        </span>
      </span>
    )
  }

  const Icon = vendorLineIcon(sNorm)
  return (
    <span className={iconWrap} title={title}>
      <Icon className={className} strokeWidth={2.25} aria-hidden />
    </span>
  )
}
