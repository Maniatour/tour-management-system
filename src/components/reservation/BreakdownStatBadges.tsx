'use client'

import type { ReactNode } from 'react'
import { Equal, Minus, Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

const pill =
  'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-semibold tabular-nums ring-1 shrink-0 leading-tight'

function IconDisc({
  children,
  bgClass,
}: {
  children: ReactNode
  bgClass: string
}) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white shadow-sm ${bgClass}`}
      aria-hidden
    >
      {children}
    </span>
  )
}

function signedInt(n: number): string {
  if (n > 0) return `+${n}`
  return String(n)
}

function formatNetSegment(netBk: number, netPe: number, locale: string, peopleUnit: string): string {
  const bkKo = netBk === 0 ? '0건' : netBk > 0 ? `+${netBk}건` : `${netBk}건`
  const bkEn =
    netBk === 0
      ? '0 bookings'
      : `${signedInt(netBk)} ${Math.abs(netBk) === 1 ? 'booking' : 'bookings'}`
  const peStr = netPe > 0 ? `+${netPe}` : String(netPe)
  const bk = locale === 'ko' ? bkKo : bkEn
  return `${bk} · ${peStr}${peopleUnit}`
}

export type BreakdownStatBadgesProps = {
  regBookings: number
  regPeople: number
  cancelBookings: number
  cancelPeople: number
  cancelPending?: boolean
  totalPending?: boolean
  groupAriaLabel?: string
}

/** 상품·채널·상태 전환 등: 등록/취소/순을 `N건 · M명` 형태의 캡슐 뱃지로 표시 */
export function BreakdownStatBadges({
  regBookings,
  regPeople,
  cancelBookings,
  cancelPeople,
  cancelPending = false,
  totalPending = false,
  groupAriaLabel,
}: BreakdownStatBadgesProps) {
  const t = useTranslations('reservations')
  const locale = useLocale()
  const peopleUnit = locale === 'ko' ? t('stats.people') : ` ${t('stats.people')}`

  const regLine = `${t('stats.bookingCountInline', { count: regBookings })} · ${regPeople}${peopleUnit}`
  const cancelLine = cancelPending
    ? '…'
    : `${t('stats.bookingCountInline', { count: cancelBookings })} · ${cancelPeople}${peopleUnit}`
  const netBk = regBookings - cancelBookings
  const netPe = regPeople - cancelPeople
  const netLine = totalPending ? '…' : formatNetSegment(netBk, netPe, locale, peopleUnit)

  const regMuted = regBookings === 0 && regPeople === 0
  const cancelMuted = !cancelPending && cancelBookings === 0 && cancelPeople === 0
  const netMuted = !totalPending && netBk === 0 && netPe === 0

  return (
    <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5" role="group" aria-label={groupAriaLabel}>
      <span
        className={`${pill} bg-emerald-50 text-emerald-950 ring-emerald-600/70 ${regMuted ? 'opacity-55' : ''}`}
      >
        <IconDisc bgClass="bg-emerald-600">
          <Plus className="h-2.5 w-2.5" strokeWidth={3} />
        </IconDisc>
        <span className="min-w-0 truncate">{regLine}</span>
      </span>
      <span
        className={`${pill} bg-rose-50 text-rose-950 ring-rose-600/70 ${cancelPending ? '' : cancelMuted ? 'opacity-55' : ''}`}
      >
        <IconDisc bgClass="bg-rose-600">
          <Minus className="h-2.5 w-2.5" strokeWidth={3} />
        </IconDisc>
        <span className="min-w-0 truncate">{cancelLine}</span>
      </span>
      <span
        className={`${pill} ring-sky-600/70 ${
          totalPending
            ? 'bg-sky-50 text-sky-950'
            : netPe < 0
              ? 'bg-amber-50 text-amber-950'
              : 'bg-sky-50 text-sky-950'
        } ${netMuted ? 'opacity-55' : ''}`}
      >
        <IconDisc bgClass={netPe < 0 && !totalPending ? 'bg-amber-600' : 'bg-sky-600'}>
          <Equal className="h-2.5 w-2.5" strokeWidth={3} />
        </IconDisc>
        <span className="min-w-0 truncate">{netLine}</span>
      </span>
    </div>
  )
}
