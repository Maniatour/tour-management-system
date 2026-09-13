'use client'

import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

export const ADMIN_TABLE_PAGE_SIZES = [20, 50, 100] as const
export const DEFAULT_ADMIN_TABLE_PAGE_SIZE = 20

type Labels = {
  showing: string
  pageOf: string
  first: string
  previous: string
  next: string
  last: string
  pageSize: string
  ariaNav: string
}

type AdminTablePaginationProps = {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: readonly number[]
  labels: Labels
}

function pageWindow(current: number, total: number, size: number): number[] {
  if (total <= size) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  if (current <= 3) {
    return Array.from({ length: size }, (_, i) => i + 1)
  }
  if (current >= total - 2) {
    return Array.from({ length: size }, (_, i) => total - size + 1 + i)
  }
  return Array.from({ length: size }, (_, i) => current - 2 + i)
}

export default function AdminTablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = ADMIN_TABLE_PAGE_SIZES,
  labels,
}: AdminTablePaginationProps) {
  if (totalItems === 0) return null

  const safeTotalPages = Math.max(1, totalPages)
  const safePage = Math.min(Math.max(1, page), safeTotalPages)
  const pages = pageWindow(safePage, safeTotalPages, 5)

  const navBtn =
    'inline-flex items-center justify-center gap-1 min-h-10 min-w-10 px-2.5 py-2 text-sm font-medium rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition duration-300 touch-manipulation'
  const pageBtn =
    'inline-flex items-center justify-center min-h-10 min-w-10 px-2.5 py-2 text-sm font-medium rounded-xl border transition duration-300 touch-manipulation'

  return (
    <nav
      aria-label={labels.ariaNav}
      className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-3 py-3 bg-gray-50/80"
    >
      <p className="text-sm text-gray-600 tabular-nums">
        <span className="font-medium text-gray-800">{labels.showing}</span>
        <span className="text-gray-400 hidden sm:inline"> · {labels.pageOf}</span>
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap mr-1">
            <span>{labels.pageSize}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="min-h-10 border border-gray-300 rounded-xl px-2 py-1.5 text-sm bg-white text-gray-800"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            className={navBtn}
            aria-label={labels.first}
          >
            <ChevronsLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{labels.first}</span>
          </button>
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className={navBtn}
            aria-label={labels.previous}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{labels.previous}</span>
          </button>

          {pages.map((pageNum) => {
            const active = pageNum === safePage
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                aria-current={active ? 'page' : undefined}
                aria-label={`${pageNum}`}
                className={`${pageBtn} ${
                  active
                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= safeTotalPages}
            className={navBtn}
            aria-label={labels.next}
          >
            <span className="hidden sm:inline">{labels.next}</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(safeTotalPages)}
            disabled={safePage >= safeTotalPages}
            className={navBtn}
            aria-label={labels.last}
          >
            <span className="hidden sm:inline">{labels.last}</span>
            <ChevronsRight className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>
      </div>
    </nav>
  )
}
