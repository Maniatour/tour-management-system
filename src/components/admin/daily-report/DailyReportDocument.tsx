'use client'

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
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${accent}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
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
    <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
      <div className="border-b border-border/40 bg-muted/40 px-4 py-2 text-sm font-semibold">{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{isKo ? '이름' : 'Name'}</th>
            <th className="px-3 py-2 text-center font-medium">{isKo ? '신규' : 'New'}</th>
            <th className="px-3 py-2 text-center font-medium">{isKo ? '취소' : 'Cancel'}</th>
            <th className="px-3 py-2 text-center font-medium">{isKo ? '순예약' : 'Net'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border/40">
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2 text-center text-emerald-700">
                {row.newCount}{isKo ? '건' : ''} / {row.newGuests}{isKo ? '명' : ''}
              </td>
              <td className="px-3 py-2 text-center text-red-600">
                {row.cancelledCount}{isKo ? '건' : ''} / {row.cancelledGuests}{isKo ? '명' : ''}
              </td>
              <td className="px-3 py-2 text-center font-semibold">
                {row.netCount}{isKo ? '건' : ''} / {row.netGuests}{isKo ? '명' : ''}
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
  const displayTotal = isCashFlow ? null : category.total

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/40 px-4 py-2.5">
        <h3 className="text-sm font-semibold">{category.title}</h3>
        {displayTotal != null ? (
          <span className="text-sm font-semibold text-red-600">{formatUsd(displayTotal)}</span>
        ) : null}
      </div>
      {category.items.length > 0 ? (
        <table className="w-full text-xs md:text-sm">
          <thead className="bg-muted/20">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{isKo ? '항목' : 'Item'}</th>
              <th className="px-3 py-2 text-left font-medium">{isKo ? '상세' : 'Detail'}</th>
              <th className="px-3 py-2 text-right font-medium">{isKo ? '금액' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            {category.items.map((item) => {
              const isNegative = item.amount < 0
              const isBalance = item.id === 'cash_on_hand'
              return (
                <tr key={item.id} className="border-t border-border/40">
                  <td className="px-3 py-2 font-medium">{item.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[item.detail, item.paymentMethod ? `(${item.paymentMethod})` : null]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
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
        <p className="px-4 py-3 text-sm text-muted-foreground">
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
      <div className="rounded-t-2xl bg-gradient-to-br from-slate-900 to-slate-700 px-8 py-8 text-white">
        <div className="text-xs font-medium uppercase tracking-widest text-white/70">
          {singleDay ? 'Daily Report' : 'Period Report'}
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{dateLabel}</h1>
        {!singleDay ? (
          <p className="mt-1 text-sm text-white/70">
            {isKo ? '기간 업무 보고' : 'Period summary report'}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-white/80">
          {isKo ? '작성' : 'By'}: {data.submittedByName || data.submittedByEmail || '—'}
        </p>
      </div>

      <div className="space-y-6 p-6 md:p-8">
        {/* 예약 */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{isKo ? '예약 관리 요약' : 'Reservations'}</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label={isKo ? '신규 접수' : 'New'}
              value={`${rs.newRegistrations.count}${isKo ? '건' : ''}`}
              sub={`${rs.newRegistrations.guests}${isKo ? '명' : ' guests'}`}
            />
            <StatCard
              label={singleDay ? (isKo ? '당일 취소' : 'Cancelled today') : (isKo ? '기간 취소' : 'Cancelled')}
              value={`${rs.cancellationsToday.count}${isKo ? '건' : ''}`}
              sub={`${rs.cancellationsToday.guests}${isKo ? '명' : ' guests'}`}
              accent="text-red-600"
            />
            <StatCard
              label={isKo ? '순예약' : 'Net'}
              value={`${rs.netReservations.count}${isKo ? '건' : ''}`}
              sub={`${rs.netReservations.guests}${isKo ? '명' : ' guests'}`}
              accent="text-emerald-600"
            />
          </div>
          <BreakdownTable title={isKo ? '투어 상품별' : 'By product'} rows={rs.byProduct} isKo={isKo} />
          <BreakdownTable title={isKo ? '채널별' : 'By channel'} rows={rs.byChannel} isKo={isKo} />
          {rs.notes.trim() ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm whitespace-pre-wrap">{rs.notes}</div>
          ) : null}
        </section>

        {/* 투어 재무 */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">
              {singleDay
                ? (isKo ? '투어 관리 요약 (재무)' : 'Tour financials')
                : (isKo ? '기간 투어 요약 (재무)' : 'Tour financials (period)')}
            </h2>
          </div>

          {ts.tours.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">{isKo ? '상품' : 'Product'}</th>
                    <th className="px-3 py-2 text-right">{isKo ? '총매출' : 'Revenue'}</th>
                    <th className="px-3 py-2 text-right">{isKo ? '잔액' : 'Bal.'}</th>
                    <th className="px-3 py-2 text-right">{isKo ? '운영 이익' : 'Op. profit'}</th>
                    <th className="px-3 py-2 text-right">{isKo ? '지출' : 'Exp.'}</th>
                    <th className="px-3 py-2 text-right">{isKo ? '순수익' : 'Net'}</th>
                  </tr>
                </thead>
                <tbody>
                  {ts.tours.map((t) => (
                    <tr key={t.id} className="border-t border-border/40">
                      <td className="px-3 py-2">
                        <div className="font-medium">{t.productName}</div>
                        <div className="text-muted-foreground">{t.guideName ?? '—'} · {t.guestCount}{isKo ? '명' : ' pax'}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{formatUsd(t.totalPayment)}</td>
                      <td className="px-3 py-2 text-right text-amber-700">{formatUsd(t.balanceOutstanding)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{formatUsd(t.totalIncome)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{formatUsd(t.totalExpenses)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatUsd(t.netProfit)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border/60 bg-muted/30 font-semibold">
                    <td className="px-3 py-2">{isKo ? '합계' : 'Total'}</td>
                    <td className="px-3 py-2 text-right">{formatUsd(ts.totals.totalPayment)}</td>
                    <td className="px-3 py-2 text-right text-amber-700">{formatUsd(ts.totals.balanceOutstanding)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{formatUsd(ts.totals.totalIncome)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{formatUsd(ts.totals.totalExpenses)}</td>
                    <td className="px-3 py-2 text-right">{formatUsd(ts.totals.netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {singleDay
                ? (isKo ? '오늘 투어가 없습니다.' : 'No tours today.')
                : (isKo ? '해당 기간 투어가 없습니다.' : 'No tours in this period.')}
            </p>
          )}
          {ts.notes.trim() ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm whitespace-pre-wrap">{ts.notes}</div>
          ) : null}
        </section>

        {/* 재무 보고 */}
        {data.financialReport ? (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold">{isKo ? '재무 보고' : 'Financial report'}</h2>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
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
                label={isKo ? '순 현금 흐름' : 'Net cash flow'}
                value={formatUsd(data.financialReport.netCashFlowToday)}
                accent="text-primary"
              />
              <StatCard
                label={isKo ? '현금 보유' : 'Cash on hand'}
                value={formatUsd(data.financialReport.cashOnHand)}
                accent="text-indigo-600"
              />
            </div>

            <div className="space-y-5">
              {data.financialReport.categories.map((cat) => (
                <FinancialCategoryBlock key={cat.key} category={cat} isKo={isKo} />
              ))}
            </div>
          </section>
        ) : null}

        {/* TODO 사용자별 */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{isKo ? 'TODO 처리 현황 (사용자별)' : 'TODO by user'}</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label={isKo ? '완료' : 'Done'} value={data.todoSummary.completedCount} accent="text-emerald-600" />
            <StatCard label={isKo ? '미처리' : 'Pending'} value={data.todoSummary.pendingCount} accent="text-amber-600" />
            <StatCard label={isKo ? '보류' : 'Hold'} value={data.todoSummary.onHoldCount} />
          </div>
          <div className="space-y-4">
            {data.todoSummary.byUser.map((u) => (
              <div key={u.userEmail} className="rounded-xl border border-border/60 p-4">
                <div className="mb-2 font-semibold">{u.userName || u.userEmail}</div>
                {u.completed.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-emerald-700">{isKo ? '완료' : 'Completed'}</div>
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {u.completed.map((i) => (
                        <li key={i.id}>✓ {i.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {u.pending.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-amber-700">{isKo ? '미처리' : 'Pending'}</div>
                    <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
                      {u.pending.map((i) => (
                        <li key={i.id}>○ {i.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {u.onHold.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">{isKo ? '보류' : 'On hold'}</div>
                    <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                      {u.onHold.map((i) => (
                        <li key={i.id}>— {i.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          {data.todoSummary.notes.trim() ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm whitespace-pre-wrap">{data.todoSummary.notes}</div>
          ) : null}
        </section>

        {/* 내일 스케줄 — 일일 보고에서만 표시 */}
        {singleDay ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">{isKo ? '내일 투어 스케줄 · 배차' : 'Tomorrow'}</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            {tomorrowLabel} — {data.tomorrowSchedule.totalTours}{isKo ? '건' : ' tours'} ·{' '}
            {isKo ? '배정 필요' : 'unassigned'} {data.tomorrowSchedule.unassignedCount}
          </p>
          {data.tomorrowSchedule.tours.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left">{isKo ? '상품' : 'Product'}</th>
                    <th className="px-4 py-2 text-left">{isKo ? '가이드' : 'Guide'}</th>
                    <th className="px-4 py-2 text-left"><Bus className="inline h-3.5 w-3.5" /> {isKo ? '차량' : 'Vehicle'}</th>
                    <th className="px-4 py-2 text-center">{isKo ? '예약' : 'Res.'}</th>
                    <th className="px-4 py-2 text-center">{isKo ? '상태' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tomorrowSchedule.tours.map((t) => (
                    <tr key={t.id} className="border-t border-border/40">
                      <td className="px-4 py-2 font-medium">{t.productName}</td>
                      <td className="px-4 py-2 text-muted-foreground">{t.guideName ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{t.vehicleLabel ?? '—'}</td>
                      <td className="px-4 py-2 text-center">{t.reservationCount}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${t.isFullyAssigned ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {t.isFullyAssigned ? (isKo ? '배정완료' : 'OK') : (isKo ? '배정필요' : 'Needed')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {data.tomorrowSchedule.notes.trim() ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm whitespace-pre-wrap">{data.tomorrowSchedule.notes}</div>
          ) : null}
        </section>
        ) : null}

        {data.additionalNotes.trim() ? (
          <section className="rounded-xl border border-border/60 bg-muted/30 p-5">
            <h2 className="mb-2 text-lg font-semibold">{isKo ? '종합 메모' : 'Notes'}</h2>
            <p className="text-sm whitespace-pre-wrap">{data.additionalNotes}</p>
          </section>
        ) : null}
      </div>
    </div>
  )
}
