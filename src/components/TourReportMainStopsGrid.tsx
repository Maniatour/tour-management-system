'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ClipboardCheck, CircleParking, Footprints } from 'lucide-react'
import {
  displayCourseName,
  type MainStopGroup,
  type MainStopGroupRow,
} from '@/lib/tourReportMainStops'
import {
  reportStopRoleFromMap,
  reportStopRoleLabel,
  type ReportStopRole,
} from '@/lib/tourReportStopRoles'
import {
  HORSESHOE_BEND_ACTIVITIES,
  isHorseshoeBendCourse,
  type HorseshoeBendActivity,
} from '@/lib/tourReportActivityDetails'

function roleBadgeClass(role: ReportStopRole): string {
  if (role === 'required') return 'bg-primary/10 text-primary'
  if (role === 'alternate') return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-50 text-emerald-800'
}

function horseshoeIcon(value: HorseshoeBendActivity) {
  if (value === 'hiking') return Footprints
  if (value === 'parking_wait') return CircleParking
  return ClipboardCheck
}

export default function TourReportMainStopsGrid({
  locale,
  rows,
  visitedIds,
  roles,
  horseshoeBend,
  horseshoeHint,
  onToggle,
  onHorseshoeActivity,
}: {
  locale: string
  rows: MainStopGroupRow[]
  visitedIds: string[]
  roles: Map<string, ReportStopRole>
  horseshoeBend: Record<string, HorseshoeBendActivity>
  horseshoeHint: string
  onToggle: (id: string, visited: boolean) => void
  onHorseshoeActivity: (id: string, value: HorseshoeBendActivity) => void
}) {
  const english = locale === 'en' || locale.startsWith('en')

  return (
    <div className="space-y-3">
      {rows.map((row, rowIndex) => (
        <div
          key={row.groups.map((group) => group.id).join('|')}
          className={cn('grid gap-3', row.groups.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}
        >
          {row.groups.map((group) => (
            <StopGroupColumn
              key={group.id}
              group={group}
              locale={locale}
              english={english}
              visitedIds={visitedIds}
              roles={roles}
              horseshoeBend={horseshoeBend}
              horseshoeHint={horseshoeHint}
              onToggle={onToggle}
              onHorseshoeActivity={onHorseshoeActivity}
              paired={row.groups.length > 1 || rowIndex >= 0}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function StopGroupColumn({
  group,
  locale,
  english,
  visitedIds,
  roles,
  horseshoeBend,
  horseshoeHint,
  onToggle,
  onHorseshoeActivity,
}: {
  group: MainStopGroup
  locale: string
  english: boolean
  visitedIds: string[]
  roles: Map<string, ReportStopRole>
  horseshoeBend: Record<string, HorseshoeBendActivity>
  horseshoeHint: string
  onToggle: (id: string, visited: boolean) => void
  onHorseshoeActivity: (id: string, value: HorseshoeBendActivity) => void
  paired: boolean
}) {
  const onlyStop = group.stops.length === 1 ? group.stops[0] : null
  const hideTitle = Boolean(
    onlyStop && displayCourseName(onlyStop.course, locale).trim() === group.title.trim()
  )

  return (
    <section className="rounded-xl border border-border/70 bg-white p-2.5 shadow-sm">
      {hideTitle ? null : (
        <h3 className="mb-2 truncate px-0.5 text-xs font-semibold tracking-tight text-foreground">
          {group.title}
        </h3>
      )}
      <div className="flex flex-col gap-1.5">
        {group.stops.map(({ id, course }) => {
          const visited = visitedIds.includes(id)
          const label = displayCourseName(course, locale)
          const horseshoe = isHorseshoeBendCourse(course)
          const reportRole = reportStopRoleFromMap(roles, id)
          return (
            <div key={id}>
              <button
                type="button"
                onClick={() => onToggle(id, !visited)}
                className={cn(
                  'flex w-full min-h-[36px] items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition',
                  visited
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted/30 text-foreground hover:bg-muted/60'
                )}
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                    visited ? 'border-white bg-white' : 'border-gray-300 bg-white'
                  )}
                >
                  {visited ? (
                    <svg className="h-2.5 w-2.5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 text-[11px] font-medium leading-snug sm:text-xs">
                  {label}
                </span>
                {reportRole ? (
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-1 py-0.5 text-[9px] font-semibold leading-none',
                      visited ? 'bg-white/20 text-white' : roleBadgeClass(reportRole)
                    )}
                  >
                    {reportStopRoleLabel(reportRole, locale)}
                  </span>
                ) : null}
              </button>
              {horseshoe && visited ? (
                <div className="mt-1.5 space-y-1 pl-1">
                  <p className="text-[10px] font-medium text-muted-foreground">{horseshoeHint}</p>
                  {HORSESHOE_BEND_ACTIVITIES.map((option) => {
                    const selected = horseshoeBend[id] === option.value
                    const Icon = horseshoeIcon(option.value)
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onHorseshoeActivity(id, option.value)}
                        className="h-auto min-h-[32px] w-full justify-start gap-1.5 whitespace-normal px-2 py-1.5 text-left text-[11px]"
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        {english ? option.en : option.ko}
                      </Button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
