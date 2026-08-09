'use client'

import { useState, Fragment, type ReactNode } from 'react'
import type {
  DailyReportData,
  DailyReportFinancialCategory,
  DailyReportTodoMatrixStatus,
} from '@/lib/dailyReport/types'
import { formatReportDateLabel, formatReportDateRangeLabel, isSingleDayReport } from '@/lib/dailyReport/dateUtils'
import { formatUsd } from '@/lib/dailyReport/moneyUtils'
import {
  Calendar,
  CheckCircle2,
  Bus,
  ChevronDown,
  ClipboardList,
  DollarSign,
  Wallet,
} from 'lucide-react'

type DailyReportDocumentProps = {
  data: DailyReportData
  locale?: string
}

function StatCard({
  label,
  value,
  sub,
  accent = 'text-primary',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2 shadow-sm sm:rounded-xl sm:p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </div>
      <div className={`mt-0.5 text-base font-semibold tracking-tight sm:text-xl ${accent}`}>{value}</div>
      {sub ? <div className="text-[10px] text-muted-foreground sm:text-xs">{sub}</div> : null}
    </div>
  )
}

/** 예약 요약용 — 인원(명)을 크게, 건수는 보조로 표시 */
function ReservationStatCard({
  label,
  count,
  guests,
  accent = 'text-primary',
  isKo,
}: {
  label: string
  count: number
  guests: number
  accent?: string
  isKo: boolean
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2 shadow-sm sm:rounded-xl sm:p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </div>
      <div className={`mt-0.5 flex items-baseline gap-1 sm:gap-1.5 ${accent}`}>
        <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{guests}</span>
        <span className="text-sm font-semibold sm:text-base">{isKo ? '명' : 'pax'}</span>
      </div>
      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground sm:text-xs">
        {count}
        {isKo ? '건' : ' bkgs'}
      </div>
    </div>
  )
}

const WEEKDAY_LABELS = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const

function YtdWeekdayAvgBanner({
  avg,
  netGuests,
  singleDay,
  isKo,
}: {
  avg: NonNullable<DailyReportData['reservationSummary']['ytdWeekdayNetAvg']>
  netGuests: number
  singleDay: boolean
  isKo: boolean
}) {
  const avgRounded = Math.round(avg.avgNetPeople)
  const delta = netGuests - avgRounded
  const deltaLabel = delta > 0 ? `+${delta}` : String(delta)
  const weekday = (isKo ? WEEKDAY_LABELS.ko : WEEKDAY_LABELS.en)[avg.weekdayIndex] ?? ''
  const deltaClass =
    delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2 sm:mt-3 sm:rounded-xl sm:px-3 sm:py-2.5">
      <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">
        {isKo
          ? `${avg.compareDate.slice(0, 4)}.1/1~${avg.throughYmd.slice(5).replace('-', '/')} · ${weekday}요일 순예약 일평균`
          : `YTD ${avg.compareDate.slice(0, 4)}-01-01~${avg.throughYmd} · ${weekday} net daily avg`}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-sm sm:text-base">
          <span className="text-muted-foreground">{isKo ? '평균 ' : 'Avg '}</span>
          <span className="text-lg font-bold tabular-nums sm:text-xl">{avgRounded}</span>
          <span className="ml-0.5 font-medium">{isKo ? '명' : ' pax'}</span>
        </p>
        <p className="text-sm sm:text-base">
          <span className="text-muted-foreground">
            {singleDay ? (isKo ? '오늘 ' : 'Today ') : isKo ? '기간 ' : 'Period '}
          </span>
          <span className="text-lg font-bold tabular-nums text-emerald-700 sm:text-xl">{netGuests}</span>
          <span className="ml-0.5 font-medium">{isKo ? '명' : ' pax'}</span>
        </p>
        {singleDay ? (
          <p className={`text-sm font-semibold tabular-nums sm:text-base ${deltaClass}`}>
            {isKo ? `평균 대비 ${deltaLabel}명` : `${deltaLabel} vs avg`}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SectionTitle({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mb-2 flex items-center gap-1.5 sm:mb-3 sm:gap-2">
      {icon}
      <h2 className="text-sm font-semibold sm:text-base">{children}</h2>
    </div>
  )
}

function NoteBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs whitespace-pre-wrap sm:mt-3 sm:rounded-xl sm:p-3 sm:text-sm">
      {children}
    </div>
  )
}

function todoStatusLabel(status: DailyReportTodoMatrixStatus, isKo: boolean) {
  if (status === 'na') return 'N/A'
  if (status === 'completed') return isKo ? '완료' : 'Done'
  if (status === 'on_hold') return isKo ? '보류' : 'Hold'
  return isKo ? '미처리' : 'Open'
}

function todoStatusClass(status: DailyReportTodoMatrixStatus) {
  if (status === 'completed') return 'text-emerald-700'
  if (status === 'on_hold') return 'text-muted-foreground'
  if (status === 'na') return 'text-muted-foreground'
  return 'text-amber-700'
}

function formatTodoCompletedAt(iso: string | null, isKo: boolean) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(isKo ? 'ko-KR' : 'en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function TodoStatusSection({
  data,
  isKo,
}: {
  data: DailyReportData
  isKo: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const rows = data.todoSummary.matrixRows ?? []
  const staffColumns = data.todoSummary.staffColumns ?? []
  const colSpan = 2 + staffColumns.length

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <section>
      <SectionTitle icon={<CheckCircle2 className="h-4 w-4 text-primary sm:h-5 sm:w-5" />}>
        {isKo ? 'TODO 처리 현황' : 'TODO by staff'}
      </SectionTitle>
      <div className="mb-2 grid grid-cols-3 gap-1.5 sm:mb-3 sm:gap-3">
        <StatCard
          label={isKo ? '완료' : 'Done'}
          value={data.todoSummary.completedCount}
          accent="text-emerald-600"
        />
        <StatCard
          label={isKo ? '미처리' : 'Pending'}
          value={data.todoSummary.pendingCount}
          accent="text-amber-600"
        />
        <StatCard label={isKo ? '보류' : 'Hold'} value={data.todoSummary.onHoldCount} />
      </div>
      <p className="mb-1.5 text-[10px] text-muted-foreground sm:text-xs">
        {isKo
          ? '큐 없는 항목은 N/A · 행 클릭 시 상세 펼침 · 출근 직원 기준 완료 체크'
          : 'No-queue → N/A · click row to expand · checks by checked-in staff'}
      </p>
      {rows.length > 0 ? (
        <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border/60 sm:rounded-xl">
          <table className="w-full min-w-[20rem] text-[11px] sm:text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="sticky left-0 z-[1] bg-muted/50 px-2 py-1 text-left sm:px-3 sm:py-1.5">
                  {isKo ? '할 일' : 'Todo'}
                </th>
                <th className="px-1.5 py-1 text-center sm:px-2 sm:py-1.5">
                  {isKo ? '상태' : 'St'}
                </th>
                {staffColumns.map((s) => (
                  <th
                    key={s.email}
                    className="max-w-[3.5rem] truncate px-1 py-1 text-center font-medium sm:max-w-none sm:px-2 sm:py-1.5"
                    title={s.name}
                  >
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const doneSet = new Set(row.completedByEmails.map((e) => e.toLowerCase()))
                const isOpen = expandedId === row.id
                return (
                  <Fragment key={row.id}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={isOpen}
                      onClick={() => toggleRow(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleRow(row.id)
                        }
                      }}
                      className={`group cursor-pointer border-t border-border/40 transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none ${
                        isOpen ? 'bg-muted/30' : ''
                      }`}
                    >
                      <td
                        className={`sticky left-0 z-[1] px-2 py-1 font-medium leading-tight group-hover:bg-muted/40 group-focus-visible:bg-muted/50 sm:px-3 sm:py-1.5 ${
                          isOpen ? 'bg-muted/30' : 'bg-white'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                              isOpen ? 'rotate-0' : '-rotate-90'
                            }`}
                            aria-hidden
                          />
                          <span>{row.title}</span>
                        </span>
                      </td>
                      <td
                        className={`px-1.5 py-1 text-center text-[10px] font-medium sm:px-2 sm:py-1.5 sm:text-xs ${todoStatusClass(row.status)}`}
                      >
                        {todoStatusLabel(row.status, isKo)}
                      </td>
                      {staffColumns.map((s) => {
                        const checked = doneSet.has(s.email.toLowerCase())
                        return (
                          <td key={s.email} className="px-1 py-1 text-center sm:px-2 sm:py-1.5">
                            {checked ? (
                              <span className="font-semibold text-emerald-600" aria-label="done">
                                ✓
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">·</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    {isOpen ? (
                      <tr className="border-t border-border/30 bg-muted/20">
                        <td colSpan={colSpan} className="px-2.5 py-2.5 sm:px-3 sm:py-3">
                          <dl className="grid gap-1.5 text-[11px] sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1.5 sm:text-sm">
                            <div className="flex items-start justify-between gap-2 sm:justify-start sm:gap-3">
                              <dt className="shrink-0 text-muted-foreground">
                                {isKo ? '상태' : 'Status'}
                              </dt>
                              <dd className={`font-medium ${todoStatusClass(row.status)}`}>
                                {todoStatusLabel(row.status, isKo)}
                                {!row.hasQueue ? (
                                  <span className="ml-1 text-[10px] font-normal text-muted-foreground sm:text-xs">
                                    ({isKo ? '큐 없음' : 'no queue'})
                                  </span>
                                ) : null}
                              </dd>
                            </div>
                            <div className="flex items-start justify-between gap-2 sm:justify-start sm:gap-3">
                              <dt className="shrink-0 text-muted-foreground">
                                {isKo ? '부서' : 'Dept'}
                              </dt>
                              <dd className="font-medium">{row.department || '—'}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-2 sm:justify-start sm:gap-3">
                              <dt className="shrink-0 text-muted-foreground">
                                {isKo ? '담당' : 'Assigned'}
                              </dt>
                              <dd className="font-medium">
                                {row.assignedToName || row.assignedToEmail || '—'}
                              </dd>
                            </div>
                            <div className="flex items-start justify-between gap-2 sm:justify-start sm:gap-3">
                              <dt className="shrink-0 text-muted-foreground">
                                {isKo ? '완료자' : 'Done by'}
                              </dt>
                              <dd className="font-medium">
                                {row.completedByNames.length > 0
                                  ? row.completedByNames.join(', ')
                                  : '—'}
                              </dd>
                            </div>
                            <div className="flex items-start justify-between gap-2 sm:col-span-2 sm:justify-start sm:gap-3">
                              <dt className="shrink-0 text-muted-foreground">
                                {isKo ? '완료 시각' : 'Completed at'}
                              </dt>
                              <dd className="font-medium">
                                {formatTodoCompletedAt(row.completedAt, isKo)}
                              </dd>
                            </div>
                          </dl>
                          {staffColumns.length > 0 ? (
                            <div className="mt-2 rounded-md border border-border/50 bg-white/70 p-2 sm:rounded-lg sm:p-2.5">
                              <div className="mb-1 text-[10px] font-medium text-muted-foreground sm:text-xs">
                                {isKo ? '출근 직원 체크' : 'Staff checks'}
                              </div>
                              <ul className="grid grid-cols-2 gap-1 text-[10px] sm:grid-cols-3 sm:text-xs md:grid-cols-4">
                                {staffColumns.map((s) => {
                                  const checked = doneSet.has(s.email.toLowerCase())
                                  return (
                                    <li
                                      key={s.email}
                                      className="flex items-center justify-between gap-2"
                                    >
                                      <span className="truncate">{s.name}</span>
                                      <span
                                        className={
                                          checked
                                            ? 'font-semibold text-emerald-600'
                                            : 'text-muted-foreground/50'
                                        }
                                      >
                                        {checked ? '✓' : '·'}
                                      </span>
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground sm:text-sm">
          {isKo ? '표시할 Todo가 없습니다.' : 'No todos to show.'}
        </p>
      )}
      {staffColumns.length === 0 && rows.length > 0 ? (
        <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
          {isKo ? '해당일 출근 기록이 없습니다.' : 'No check-ins for this date.'}
        </p>
      ) : null}
      {data.todoSummary.notes.trim() ? <NoteBox>{data.todoSummary.notes}</NoteBox> : null}
    </section>
  )
}

function BreakdownTable({
  title,
  rows,
  isKo,
}: {
  title: string
  rows: DailyReportData['reservationSummary']['byProduct']
  isKo: boolean
}) {
  if (!rows.length) return null
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border/60 sm:mt-3 sm:rounded-xl">
      <div className="border-b border-border/40 bg-muted/40 px-2.5 py-1.5 text-xs font-semibold sm:px-3 sm:py-2 sm:text-sm">
        {title}
      </div>
      <table className="w-full text-[11px] sm:text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-2 py-1 text-left font-medium sm:px-3 sm:py-1.5">{isKo ? '이름' : 'Name'}</th>
            <th className="px-2 py-1 text-center font-medium sm:px-3 sm:py-1.5">{isKo ? '신규' : 'New'}</th>
            <th className="px-2 py-1 text-center font-medium sm:px-3 sm:py-1.5">{isKo ? '취소' : 'Cancel'}</th>
            <th className="px-2 py-1 text-center font-medium sm:px-3 sm:py-1.5">{isKo ? '순' : 'Net'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border/40">
              <td className="px-2 py-1 font-medium sm:px-3 sm:py-1.5">{row.name}</td>
              <td className="px-2 py-1 text-center text-emerald-700 sm:px-3 sm:py-1.5">
                {row.newCount}/{row.newGuests}
              </td>
              <td className="px-2 py-1 text-center text-red-600 sm:px-3 sm:py-1.5">
                {row.cancelledCount}/{row.cancelledGuests}
              </td>
              <td className="px-2 py-1 text-center font-semibold sm:px-3 sm:py-1.5">
                {row.netCount}/{row.netGuests}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FinancialCategoryBlock({
  category,
  isKo,
}: {
  category: DailyReportFinancialCategory
  isKo: boolean
}) {
  const isCashFlow = category.key === 'cash'
  const isBooking = category.key === 'booking'
  const displayTotal = isCashFlow ? null : category.total

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 sm:rounded-xl">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/40 px-2.5 py-1.5 sm:px-3 sm:py-2">
        <h3 className="text-xs font-semibold sm:text-sm">{category.title}</h3>
        {displayTotal != null ? (
          <span className="text-xs font-semibold text-red-600 sm:text-sm">{formatUsd(displayTotal)}</span>
        ) : null}
      </div>
      {category.items.length > 0 ? (
        <table className="w-full text-[11px] sm:text-sm">
          <thead className="bg-muted/20">
            <tr>
              <th className="px-2 py-1 text-left font-medium sm:px-3 sm:py-1.5">{isKo ? '항목' : 'Item'}</th>
              {isCashFlow ? (
                <>
                  <th className="px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5">
                    {isKo ? '지출' : 'Out'}
                  </th>
                  <th className="px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5">
                    {isKo ? '입금' : 'In'}
                  </th>
                  <th className="px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5">
                    {isKo ? '보유' : 'Hold'}
                  </th>
                </>
              ) : (
                <>
                  <th className="px-2 py-1 text-left font-medium sm:px-3 sm:py-1.5">
                    {isKo ? '상세' : 'Detail'}
                  </th>
                  {isBooking ? (
                    <>
                      <th className="px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5">EA</th>
                      <th className="px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5">
                        {isKo ? '개당' : 'Unit'}
                      </th>
                    </>
                  ) : null}
                  <th className="px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5">
                    {isKo ? '금액' : 'Amt'}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {category.items.map((item) => {
              const isNegative = item.amount < 0
              const isBalance = item.id === 'cash_on_hand'

              if (isCashFlow) {
                const spent = isBalance ? null : isNegative ? Math.abs(item.amount) : null
                const deposited = isBalance ? null : !isNegative ? item.amount : null
                return (
                  <tr key={item.id} className="border-t border-border/40">
                    <td className="px-2 py-1 font-medium sm:px-3 sm:py-1.5">{item.label}</td>
                    <td className="px-2 py-1 text-right font-medium text-red-600 sm:px-3 sm:py-1.5">
                      {spent != null ? formatUsd(spent) : '—'}
                    </td>
                    <td className="px-2 py-1 text-right font-medium text-emerald-700 sm:px-3 sm:py-1.5">
                      {deposited != null ? formatUsd(deposited) : '—'}
                    </td>
                    <td className="px-2 py-1 text-right font-medium text-indigo-700 sm:px-3 sm:py-1.5">
                      {isBalance ? formatUsd(item.amount) : '—'}
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={item.id} className="border-t border-border/40">
                  <td className="px-2 py-1 font-medium sm:px-3 sm:py-1.5">{item.label}</td>
                  <td className="max-w-[9rem] truncate px-2 py-1 text-muted-foreground sm:max-w-none sm:whitespace-normal sm:px-3 sm:py-1.5">
                    {[item.detail, item.paymentMethod ? `(${item.paymentMethod})` : null]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </td>
                  {isBooking ? (
                    <>
                      <td className="px-2 py-1 text-right text-muted-foreground sm:px-3 sm:py-1.5">
                        {item.ea != null ? item.ea : '—'}
                      </td>
                      <td className="px-2 py-1 text-right text-muted-foreground sm:px-3 sm:py-1.5">
                        {item.unitPrice != null ? formatUsd(item.unitPrice) : '—'}
                      </td>
                    </>
                  ) : null}
                  <td
                    className={`px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5 ${
                      isNegative ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {isNegative ? `-${formatUsd(Math.abs(item.amount))}` : formatUsd(item.amount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <p className="px-2.5 py-2 text-xs text-muted-foreground sm:px-3 sm:py-2.5 sm:text-sm">
          {isKo ? '해당 항목이 없습니다.' : 'No items.'}
        </p>
      )}
    </div>
  )
}

export function DailyReportDocument({ data, locale = 'ko' }: DailyReportDocumentProps) {
  const isKo = locale.startsWith('ko')
  const endDate = data.reportEndDate ?? data.reportDate
  const singleDay = isSingleDayReport(data.reportDate, endDate)
  const dateLabel = formatReportDateRangeLabel(data.reportDate, endDate, locale)
  const tomorrowLabel = formatReportDateLabel(data.tomorrowSchedule.date, locale)
  const rs = data.reservationSummary
  const ts = data.tourSummary

  return (
    <div className="bg-white text-foreground" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="rounded-t-xl bg-gradient-to-br from-slate-900 to-slate-700 px-4 py-3 text-white sm:rounded-t-2xl sm:px-6 sm:py-5">
        <div className="text-[10px] font-medium uppercase tracking-widest text-white/70 sm:text-xs">
          {singleDay ? 'Daily Report' : 'Period Report'}
        </div>
        <h1 className="mt-0.5 text-lg font-bold tracking-tight sm:mt-1 sm:text-2xl">{dateLabel}</h1>
        {!singleDay ? (
          <p className="mt-0.5 text-[11px] text-white/70 sm:text-sm">
            {isKo ? '기간 업무 보고' : 'Period summary report'}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-white/80 sm:text-sm">
          {isKo ? '작성' : 'By'}: {data.submittedByName || data.submittedByEmail || '—'}
        </p>
      </div>

      <div className="space-y-3 p-3 sm:space-y-5 sm:p-5 md:p-6">
        <section>
          <SectionTitle icon={<ClipboardList className="h-4 w-4 text-primary sm:h-5 sm:w-5" />}>
            {isKo ? '예약 관리 요약' : 'Reservations'}
          </SectionTitle>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            <ReservationStatCard
              label={isKo ? '신규' : 'New'}
              count={rs.newRegistrations.count}
              guests={rs.newRegistrations.guests}
              isKo={isKo}
            />
            <ReservationStatCard
              label={isKo ? '취소' : 'Cancel'}
              count={rs.cancellationsToday.count}
              guests={rs.cancellationsToday.guests}
              accent="text-red-600"
              isKo={isKo}
            />
            <ReservationStatCard
              label={isKo ? '순예약' : 'Net'}
              count={rs.netReservations.count}
              guests={rs.netReservations.guests}
              accent="text-emerald-600"
              isKo={isKo}
            />
          </div>
          {rs.ytdWeekdayNetAvg ? (
            <YtdWeekdayAvgBanner
              avg={rs.ytdWeekdayNetAvg}
              netGuests={rs.netReservations.guests}
              singleDay={singleDay}
              isKo={isKo}
            />
          ) : null}
          <BreakdownTable title={isKo ? '투어 상품별' : 'By product'} rows={rs.byProduct} isKo={isKo} />
          <BreakdownTable title={isKo ? '채널별' : 'By channel'} rows={rs.byChannel} isKo={isKo} />
          {rs.notes.trim() ? <NoteBox>{rs.notes}</NoteBox> : null}
        </section>

        <section>
          <SectionTitle icon={<DollarSign className="h-4 w-4 text-emerald-600 sm:h-5 sm:w-5" />}>
            {singleDay
              ? isKo
                ? '투어 관리 요약 (재무)'
                : 'Tour financials'
              : isKo
                ? '기간 투어 요약 (재무)'
                : 'Tour financials (period)'}
          </SectionTitle>

          {ts.tours.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border/60 sm:rounded-xl">
              <table className="w-full table-fixed text-[10px] sm:text-sm">
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-1.5 py-1 text-left font-medium sm:px-3 sm:py-1.5">
                      {isKo ? '상품' : 'Product'}
                    </th>
                    <th className="px-0.5 py-1 text-right font-medium sm:px-2 sm:py-1.5">
                      {isKo ? '총매출' : 'Rev'}
                    </th>
                    <th className="px-0.5 py-1 text-right font-medium sm:px-2 sm:py-1.5">
                      {isKo ? '지출' : 'Exp'}
                    </th>
                    <th className="px-0.5 py-1 text-right font-medium sm:px-2 sm:py-1.5">
                      {isKo ? '순이익' : 'Net'}
                    </th>
                    <th className="px-1.5 py-1 text-right font-medium sm:px-2 sm:py-1.5">
                      {isKo ? '잔액' : 'Bal'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ts.tours.map((t) => (
                    <tr key={t.id} className="border-t border-border/40">
                      <td className="px-1.5 py-1 sm:px-3 sm:py-1.5">
                        <div className="truncate font-medium leading-tight" title={t.productName}>
                          {t.productName}
                        </div>
                        <div className="truncate text-[9px] text-muted-foreground sm:text-xs">
                          {t.guideName ?? '—'} · {t.guestCount}
                          {isKo ? '명' : 'p'}
                        </div>
                      </td>
                      <td className="px-0.5 py-1 text-right tabular-nums text-emerald-700 sm:px-2 sm:py-1.5">
                        {formatUsd(t.totalIncome)}
                      </td>
                      <td className="px-0.5 py-1 text-right tabular-nums text-red-600 sm:px-2 sm:py-1.5">
                        {formatUsd(t.totalExpenses)}
                      </td>
                      <td className="px-0.5 py-1 text-right font-semibold tabular-nums sm:px-2 sm:py-1.5">
                        {formatUsd(t.netProfit)}
                      </td>
                      <td className="px-1.5 py-1 text-right tabular-nums text-amber-700 sm:px-2 sm:py-1.5">
                        {formatUsd(t.balanceOutstanding)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border/60 bg-muted/30 font-semibold">
                    <td className="px-1.5 py-1 sm:px-3 sm:py-1.5">{isKo ? '합계' : 'Total'}</td>
                    <td className="px-0.5 py-1 text-right tabular-nums text-emerald-700 sm:px-2 sm:py-1.5">
                      {formatUsd(ts.totals.totalIncome)}
                    </td>
                    <td className="px-0.5 py-1 text-right tabular-nums text-red-600 sm:px-2 sm:py-1.5">
                      {formatUsd(ts.totals.totalExpenses)}
                    </td>
                    <td className="px-0.5 py-1 text-right tabular-nums sm:px-2 sm:py-1.5">
                      {formatUsd(ts.totals.netProfit)}
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-amber-700 sm:px-2 sm:py-1.5">
                      {formatUsd(ts.totals.balanceOutstanding)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground sm:text-sm">
              {singleDay
                ? isKo
                  ? '오늘 투어가 없습니다.'
                  : 'No tours today.'
                : isKo
                  ? '해당 기간 투어가 없습니다.'
                  : 'No tours in this period.'}
            </p>
          )}
          {ts.notes.trim() ? <NoteBox>{ts.notes}</NoteBox> : null}
        </section>

        {data.financialReport ? (
          <section>
            <SectionTitle icon={<Wallet className="h-4 w-4 text-indigo-600 sm:h-5 sm:w-5" />}>
              {isKo ? '재무 보고' : 'Financial report'}
            </SectionTitle>

            <div className="mb-2 grid grid-cols-2 gap-1.5 sm:mb-3 sm:gap-3 md:grid-cols-4">
              <StatCard
                label={isKo ? '현금 입금' : 'Cash in'}
                value={formatUsd(data.financialReport.cashInflowToday)}
                accent="text-emerald-600"
              />
              <StatCard
                label={isKo ? '현금 지출' : 'Cash out'}
                value={formatUsd(data.financialReport.cashOutflowToday)}
                accent="text-red-600"
              />
              <StatCard
                label={isKo ? '순현금' : 'Net cash'}
                value={formatUsd(data.financialReport.netCashFlowToday)}
                accent="text-primary"
              />
              <StatCard
                label={isKo ? '현금 보유' : 'On hand'}
                value={formatUsd(data.financialReport.cashOnHand)}
                accent="text-indigo-600"
              />
            </div>

            <div className="space-y-2 sm:space-y-3">
              {data.financialReport.categories.map((cat) => (
                <FinancialCategoryBlock key={cat.key} category={cat} isKo={isKo} />
              ))}
            </div>
          </section>
        ) : null}

        <TodoStatusSection data={data} isKo={isKo} />

        {singleDay ? (
          <section>
            <SectionTitle icon={<Calendar className="h-4 w-4 text-indigo-600 sm:h-5 sm:w-5" />}>
              {isKo ? '내일 투어 스케줄' : 'Tomorrow'}
            </SectionTitle>
            <p className="mb-2 text-[11px] text-muted-foreground sm:mb-3 sm:text-sm">
              {tomorrowLabel} — {data.tomorrowSchedule.totalTours}
              {isKo ? '건' : ' tours'} · {isKo ? '배정필요' : 'need'}{' '}
              {data.tomorrowSchedule.unassignedCount}
            </p>
            {data.tomorrowSchedule.tours.length > 0 ? (
              <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border/60 sm:rounded-xl">
                <table className="w-full min-w-[26rem] text-[11px] sm:min-w-0 sm:text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-1 text-left sm:px-3 sm:py-1.5">{isKo ? '상품' : 'Product'}</th>
                      <th className="px-2 py-1 text-left sm:px-3 sm:py-1.5">{isKo ? '가이드' : 'Guide'}</th>
                      <th className="px-2 py-1 text-left sm:px-3 sm:py-1.5">
                        <Bus className="inline h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </th>
                      <th className="px-2 py-1 text-center sm:px-3 sm:py-1.5">{isKo ? '예약' : 'Res'}</th>
                      <th className="px-2 py-1 text-center sm:px-3 sm:py-1.5">{isKo ? '상태' : 'St'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tomorrowSchedule.tours.map((t) => (
                      <tr key={t.id} className="border-t border-border/40">
                        <td className="px-2 py-1 font-medium sm:px-3 sm:py-1.5">{t.productName}</td>
                        <td className="px-2 py-1 text-muted-foreground sm:px-3 sm:py-1.5">
                          {t.guideName ?? '—'}
                        </td>
                        <td className="px-2 py-1 text-muted-foreground sm:px-3 sm:py-1.5">
                          {t.vehicleLabel ?? '—'}
                        </td>
                        <td className="px-2 py-1 text-center sm:px-3 sm:py-1.5">{t.reservationCount}</td>
                        <td className="px-2 py-1 text-center sm:px-3 sm:py-1.5">
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:text-xs ${
                              t.isFullyAssigned
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {t.isFullyAssigned
                              ? isKo
                                ? '완료'
                                : 'OK'
                              : isKo
                                ? '필요'
                                : 'Need'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {data.tomorrowSchedule.notes.trim() ? (
              <NoteBox>{data.tomorrowSchedule.notes}</NoteBox>
            ) : null}
          </section>
        ) : null}

        {data.additionalNotes.trim() ? (
          <section className="rounded-lg border border-border/60 bg-muted/30 p-2.5 sm:rounded-xl sm:p-4">
            <h2 className="mb-1 text-sm font-semibold sm:mb-2 sm:text-base">
              {isKo ? '종합 메모' : 'Notes'}
            </h2>
            <p className="text-xs whitespace-pre-wrap sm:text-sm">{data.additionalNotes}</p>
          </section>
        ) : null}
      </div>
    </div>
  )
}
