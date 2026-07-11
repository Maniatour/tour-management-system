'use client'

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleCheck,
  HelpCircle,
  MessageCircle,
  XCircle,
} from 'lucide-react'

type ReservationStatusIconProps = {
  status: string | null | undefined
  className?: string
  title?: string
}

export function ReservationStatusIcon({ status, className = 'h-3.5 w-3.5 shrink-0', title }: ReservationStatusIconProps) {
  const x = String(status ?? '').trim().toLowerCase()
  const aria = title ? { title, 'aria-label': title } : { 'aria-hidden': true as const }

  if (x === 'confirmed') {
    return <CheckCircle2 className={`${className} text-emerald-600`} {...aria} />
  }
  if (x === 'completed') {
    return <CircleCheck className={`${className} text-primary`} {...aria} />
  }
  if (x === 'cancelled' || x === 'canceled') {
    return <XCircle className={`${className} text-red-600`} {...aria} />
  }
  if (x === 'no_show') {
    return <XCircle className={`${className} text-orange-600`} {...aria} />
  }
  if (x === 'pending') {
    return <AlertCircle className={`${className} text-amber-600`} {...aria} />
  }
  if (x === 'inquiry') {
    return <MessageCircle className={`${className} text-sky-600`} {...aria} />
  }
  if (x === 'recruiting') {
    return <Circle className={`${className} text-purple-600`} {...aria} />
  }
  if (x === 'deleted') {
    return <XCircle className={`${className} text-gray-500`} {...aria} />
  }
  return <HelpCircle className={`${className} text-gray-400`} {...aria} />
}
