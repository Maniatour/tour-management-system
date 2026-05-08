'use client'

import { useTranslations } from 'next-intl'

export const RESERVATION_EXPENSE_PAGE_SIZES = [10, 25, 50, 100] as const

export function reservationExpenseTotalPages(totalFiltered: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalFiltered) / pageSize))
}

type Props = {
  page: number
  totalPages: number
  pageSize: number
  totalFiltered: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export default function ReservationExpenseTabPager({
  page,
  totalPages,
  pageSize,
  totalFiltered,
  onPageChange,
  onPageSizeChange
}: Props) {
  const t = useTranslations('expenses.reservationSubTabs')
  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, totalFiltered)

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-2 text-sm text-gray-700">
      <p className="tabular-nums text-xs text-gray-600 order-2 sm:order-1">
        {t('pagerShowing', { from, to, total: totalFiltered })}
      </p>
      <div className="flex flex-wrap items-center gap-2 order-1 sm:order-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
          <span>{t('pageSizeLabel')}</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
          >
            {RESERVATION_EXPENSE_PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
          >
            {t('pagerPrev')}
          </button>
          <span className="tabular-nums text-xs font-medium text-gray-800 min-w-[6.5rem] text-center px-1">
            {t('pagerPageOf', { current: safePage, total: totalPages })}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
          >
            {t('pagerNext')}
          </button>
        </div>
      </div>
    </div>
  )
}
