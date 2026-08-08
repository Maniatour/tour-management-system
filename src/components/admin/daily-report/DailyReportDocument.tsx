'use client'

import type { ReactNode } from 'react'
import type { DailyReportData, DailyReportFinancialCategory } from '@/lib/dailyReport/types'
import { formatReportDateLabel, formatReportDateRangeLabel, isSingleDayReport } from '@/lib/dailyReport/dateUtils'
import { formatUsd } from '@/lib/dailyReport/moneyUtils'
import {
  Calendar,
  CheckCircle2,
  Bus,
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
              <th className="px-2 py-1 text-left font-medium sm:px-3 sm:py-1.5">{isKo ? '상세' : 'Detail'}</th>
              {isBooking ? (
                <>
                  <th className="px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5">EA</th>
                  <th className="px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5">
                    {isKo ? '개당' : 'Unit'}
                  </th>
                </>
              ) : null}
              <th className="px-2 py-1 text-right font-medium sm:px-3 sm:py-1.5">{isKo ? '금액' : 'Amt'}</th>
            </tr>
          </thead>
          <tbody>
            {category.items.map((item) => {
              const isNegative = item.amount < 0
              const isBalance = item.id === 'cash_on_hand'
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
                      isBalance
                        ? 'text-indigo-700'
                        : isNegative
                          ? 'text-red-600'
                          : 'text-emerald-700'
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
            <StatCard
              label={isKo ? '신규' : 'New'}
              value={`${rs.newRegistrations.count}${isKo ? '건' : ''}`}
              sub={`${rs.newRegistrations.guests}${isKo ? '명' : ' pax'}`}
            />
            <StatCard
              label={isKo ? '취소' : 'Cancel'}
              value={`${rs.cancellationsToday.count}${isKo ? '건' : ''}`}
              sub={`${rs.cancellationsToday.guests}${isKo ? '명' : ' pax'}`}
              accent="text-red-600"
            />
            <StatCard
              label={isKo ? '순예약' : 'Net'}
              value={`${rs.netReservations.count}${isKo ? '건' : ''}`}
              sub={`${rs.netReservations.guests}${isKo ? '명' : ' pax'}`}
              accent="text-emerald-600"
            />
          </div>
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
            <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border/60 sm:rounded-xl">
              <table className="w-full min-w-[28rem] text-[11px] sm:min-w-0 sm:text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1 text-left sm:px-3 sm:py-1.5">{isKo ? '상품' : 'Product'}</th>
                    <th className="px-2 py-1 text-right sm:px-3 sm:py-1.5">{isKo ? '총매출' : 'Rev.'}</th>
                    <th className="px-2 py-1 text-right sm:px-3 sm:py-1.5">{isKo ? '지출' : 'Exp.'}</th>
                    <th className="px-2 py-1 text-right sm:px-3 sm:py-1.5">{isKo ? '순이익' : 'Net'}</th>
                    <th className="px-2 py-1 text-right sm:px-3 sm:py-1.5">{isKo ? '잔액' : 'Bal.'}</th>
                  </tr>
                </thead>
                <tbody>
                  {ts.tours.map((t) => (
                    <tr key={t.id} className="border-t border-border/40">
                      <td className="px-2 py-1 sm:px-3 sm:py-1.5">
                        <div className="font-medium leading-tight">{t.productName}</div>
                        <div className="text-[10px] text-muted-foreground sm:text-xs">
                          {t.guideName ?? '—'} · {t.guestCount}
                          {isKo ? '명' : 'p'}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right text-emerald-700 sm:px-3 sm:py-1.5">
                        {formatUsd(t.totalIncome)}
                      </td>
                      <td className="px-2 py-1 text-right text-red-600 sm:px-3 sm:py-1.5">
                        {formatUsd(t.totalExpenses)}
                      </td>
                      <td className="px-2 py-1 text-right font-semibold sm:px-3 sm:py-1.5">
                        {formatUsd(t.netProfit)}
                      </td>
                      <td className="px-2 py-1 text-right text-amber-700 sm:px-3 sm:py-1.5">
                        {formatUsd(t.balanceOutstanding)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border/60 bg-muted/30 font-semibold">
                    <td className="px-2 py-1 sm:px-3 sm:py-1.5">{isKo ? '합계' : 'Total'}</td>
                    <td className="px-2 py-1 text-right text-emerald-700 sm:px-3 sm:py-1.5">
                      {formatUsd(ts.totals.totalIncome)}
                    </td>
                    <td className="px-2 py-1 text-right text-red-600 sm:px-3 sm:py-1.5">
                      {formatUsd(ts.totals.totalExpenses)}
                    </td>
                    <td className="px-2 py-1 text-right sm:px-3 sm:py-1.5">
                      {formatUsd(ts.totals.netProfit)}
                    </td>
                    <td className="px-2 py-1 text-right text-amber-700 sm:px-3 sm:py-1.5">
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

        <section>
          <SectionTitle icon={<CheckCircle2 className="h-4 w-4 text-primary sm:h-5 sm:w-5" />}>
            {isKo ? 'TODO 처리 현황' : 'TODO by user'}
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
          <div className="space-y-2 sm:space-y-3">
            {data.todoSummary.byUser.map((u) => (
              <div
                key={u.userEmail}
                className="rounded-lg border border-border/60 p-2.5 sm:rounded-xl sm:p-3"
              >
                <div className="mb-1 text-xs font-semibold sm:mb-1.5 sm:text-sm">
                  {u.userName || u.userEmail}
                </div>
                {u.completed.length > 0 && (
                  <div className="mb-1.5">
                    <div className="text-[10px] font-medium text-emerald-700 sm:text-xs">
                      {isKo ? '완료' : 'Completed'}
                    </div>
                    <ul className="mt-0.5 space-y-0.5 text-[11px] sm:text-sm">
                      {u.completed.map((i) => (
                        <li key={i.id}>✓ {i.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {u.pending.length > 0 && (
                  <div className="mb-1.5">
                    <div className="text-[10px] font-medium text-amber-700 sm:text-xs">
                      {isKo ? '미처리' : 'Pending'}
                    </div>
                    <ul className="mt-0.5 space-y-0.5 text-[11px] text-amber-900 sm:text-sm">
                      {u.pending.map((i) => (
                        <li key={i.id}>○ {i.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {u.onHold.length > 0 && (
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                      {isKo ? '보류' : 'On hold'}
                    </div>
                    <ul className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground sm:text-sm">
                      {u.onHold.map((i) => (
                        <li key={i.id}>— {i.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          {data.todoSummary.notes.trim() ? <NoteBox>{data.todoSummary.notes}</NoteBox> : null}
        </section>

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
