'use client'

import { Bus, User, UserCircle } from 'lucide-react'
import {
  formatTicketBookingTourHeadline,
  ticketBookingTourDetailBadges,
  type TicketBookingTourEnrichment,
} from '@/lib/ticket-booking-tour-display'
import { tourChoiceCountsDisplayKeys } from '@/lib/tourChoiceCounts'

const badgeBase =
  'inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight'

function TourChoiceCountBadgeRow({ counts }: { counts: NonNullable<TicketBookingTourEnrichment['choice_counts']> }) {
  const keys = tourChoiceCountsDisplayKeys(counts)
  if (keys.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keys.map((k) => (
        <span
          key={k}
          className={`${badgeBase} bg-teal-50 text-teal-950 ring-1 ring-teal-200/80 tabular-nums`}
          title={`${k} : ${counts[k]}`}
        >
          <span aria-hidden>🏜️</span>
          <span>
            {k} : {counts[k]}
          </span>
        </span>
      ))}
    </span>
  )
}

function TourStaffBadgeRow({
  tours,
  omitPeople,
}: {
  tours: TicketBookingTourEnrichment
  omitPeople?: boolean
}) {
  const badges = ticketBookingTourDetailBadges(
    tours,
    omitPeople === undefined ? {} : { omitPeople }
  )
  if (badges.length === 0) return null

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1">
      {badges.map((b) => {
        if (b.kind === 'guide') {
          return (
            <span
              key={`guide-${b.name}`}
              className={`${badgeBase} bg-sky-100 text-sky-900 ring-1 ring-sky-200/80`}
              title={b.name}
            >
              <UserCircle className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              <span className="truncate max-w-[5rem]">{b.name}</span>
            </span>
          )
        }
        if (b.kind === 'assistant') {
          return (
            <span
              key={`asst-${b.name}`}
              className={`${badgeBase} bg-violet-100 text-violet-900 ring-1 ring-violet-200/80`}
              title={b.name}
            >
              <User className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              <span className="truncate max-w-[5rem]">{b.name}</span>
            </span>
          )
        }
        if (b.kind === 'vehicle') {
          return (
            <span
              key={`veh-${b.label}`}
              className={`${badgeBase} bg-amber-100 text-amber-950 ring-1 ring-amber-200/80`}
              title={b.label}
            >
              <Bus className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              <span className="truncate max-w-[4.5rem]">{b.label}</span>
            </span>
          )
        }
        return null
      })}
    </div>
  )
}

export function TicketBookingTourDisplay({
  locale,
  tours,
  tourFallback,
  className = '',
  headlineClassName = 'font-medium text-gray-900',
  onTourClick,
  /** true: 1행 헤드라인 + 2행 가이드·어시·배차 (목록 테이블) */
  layout = 'default',
  showDetails = true,
  appendPeopleToHeadline = false,
}: {
  locale: string
  tours: TicketBookingTourEnrichment | undefined
  tourFallback: string
  className?: string
  headlineClassName?: string
  onTourClick?: () => void
  layout?: 'default' | 'table'
  showDetails?: boolean
  appendPeopleToHeadline?: boolean
}) {
  const isTable = layout === 'table'
  const headline = formatTicketBookingTourHeadline(locale, tours, tourFallback, {
    appendPeople: isTable || (appendPeopleToHeadline && !showDetails),
  })
  const showStaffRow =
    tours && (isTable || (showDetails && !isTable))
      ? ticketBookingTourDetailBadges(tours, { omitPeople: isTable }).length > 0
      : false
  const showChoiceBadges = isTable && tours?.choice_counts

  if (!headline && !showStaffRow && !showChoiceBadges) return null

  const inner = (
    <>
      {headline || showChoiceBadges ? (
        <div
          className={`flex flex-wrap items-center gap-1 ${isTable ? 'text-[11px] leading-snug' : ''}`}
        >
          {headline ? <span className={headlineClassName}>{headline}</span> : null}
          {showChoiceBadges ? <TourChoiceCountBadgeRow counts={tours!.choice_counts!} /> : null}
        </div>
      ) : null}
      {showStaffRow && tours ? (
        <TourStaffBadgeRow tours={tours} omitPeople={isTable} />
      ) : null}
    </>
  )

  if (onTourClick) {
    return (
      <button
        type="button"
        className={`block min-w-0 text-left ${className} cursor-pointer hover:text-primary hover:underline`}
        onClick={(e) => {
          e.stopPropagation()
          onTourClick()
        }}
        title={locale.startsWith('ko') ? '투어 상세 보기' : 'View tour'}
      >
        {inner}
      </button>
    )
  }

  return <div className={`min-w-0 ${className}`}>{inner}</div>
}
