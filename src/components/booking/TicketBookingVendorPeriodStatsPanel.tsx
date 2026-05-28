'use client'

import type { ReactNode } from 'react'
import { BarChart3, Calendar, DollarSign, Link2, Ticket, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  formatTicketBookingStatsUsd,
  type TicketBookingVendorPeriodStats,
} from '@/lib/ticketBookingVendorPeriodStats'
import {
  formatTicketBookingStatusLabel,
  getTicketBookingStatusBadgeClass,
} from '@/lib/ticketBookingStatus'

type Props = {
  vendor: string
  from: string
  to: string
  dateBasis: 'check_in' | 'submit_on'
  stats: TicketBookingVendorPeriodStats
  locale: string
}

export default function TicketBookingVendorPeriodStatsPanel({
  vendor,
  from,
  to,
  dateBasis,
  stats,
  locale,
}: Props) {
  const t = useTranslations('booking.calendar')

  const titleKey =
    dateBasis === 'submit_on' ? 'vendorPeriodStatsTitleSubmitOn' : 'vendorPeriodStatsTitleTourDate'

  return (
    <section
      className="mx-3 mb-3 sm:mx-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white shadow-sm"
      aria-label={t('vendorPeriodStatsAria')}
    >
      <div className="border-b border-blue-100 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-600 shrink-0" aria-hidden />
          <h3 className="text-sm font-semibold text-gray-900">
            {t(titleKey, { vendor, from, to })}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 p-3 sm:p-4">
        <StatCard
          icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />}
          iconBg="bg-blue-100"
          label={t('vendorPeriodStatsTotalBookings')}
          value={String(stats.totalRows)}
          sub={
            stats.cancelledRows > 0
              ? t('vendorPeriodStatsCancelledSub', { count: stats.cancelledRows })
              : undefined
          }
        />
        <StatCard
          icon={<Ticket className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />}
          iconBg="bg-emerald-100"
          label={t('vendorPeriodStatsActiveBookings')}
          value={String(stats.activeRows)}
        />
        <StatCard
          icon={<Users className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-700" />}
          iconBg="bg-cyan-100"
          label={t('vendorPeriodStatsTotalEa')}
          value={stats.totalEa.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />}
          iconBg="bg-green-100"
          label={t('vendorPeriodStatsTotalExpense')}
          value={formatTicketBookingStatsUsd(stats.totalExpenseUsd)}
        />
        <StatCard
          icon={<Link2 className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />}
          iconBg="bg-violet-100"
          label={t('vendorPeriodStatsTourConnected')}
          value={
            stats.totalRows > 0
              ? t('vendorPeriodStatsTourConnectedValue', {
                  connected: stats.tourConnectedRows,
                  total: stats.totalRows,
                })
              : '0'
          }
        />
      </div>

      {(stats.byStatus.length > 0 || stats.byCategory.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
          {stats.byStatus.length > 0 && (
            <BreakdownBlock title={t('vendorPeriodStatsByStatus')}>
              {stats.byStatus.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-gray-100 bg-white/80 px-2.5 py-2 text-xs"
                >
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${getTicketBookingStatusBadgeClass(row.key)}`}
                  >
                    {formatTicketBookingStatusLabel(row.key, t, locale)}
                  </span>
                  <span className="tabular-nums text-gray-700">
                    {t('vendorPeriodStatsBreakdownLine', {
                      count: row.count,
                      ea: row.ea,
                      expense: formatTicketBookingStatsUsd(row.expenseUsd),
                    })}
                  </span>
                </div>
              ))}
            </BreakdownBlock>
          )}
          {stats.byCategory.length > 0 && (
            <BreakdownBlock title={t('vendorPeriodStatsByCategory')}>
              {stats.byCategory.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-gray-100 bg-white/80 px-2.5 py-2 text-xs"
                >
                  <span className="font-medium text-gray-900 truncate max-w-[55%]" title={row.key}>
                    {row.key}
                  </span>
                  <span className="tabular-nums text-gray-700">
                    {t('vendorPeriodStatsBreakdownLine', {
                      count: row.count,
                      ea: row.ea,
                      expense: formatTicketBookingStatsUsd(row.expenseUsd),
                    })}
                  </span>
                </div>
              ))}
            </BreakdownBlock>
          )}
        </div>
      )}
    </section>
  )
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: ReactNode
  iconBg: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-lg p-2.5 sm:p-3 border border-gray-200 min-w-0">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg flex-shrink-0 ${iconBg}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-medium text-gray-600 leading-snug">{label}</p>
          <p className="text-base sm:text-xl font-bold text-gray-900 tabular-nums truncate">{value}</p>
          {sub ? <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p> : null}
        </div>
      </div>
    </div>
  )
}

function BreakdownBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/60 p-2.5 sm:p-3">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}
