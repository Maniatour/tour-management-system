'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Trash2, X } from 'lucide-react'
import type { ReservationStatusCode } from '@/lib/reservationStatus'
import { useReservationFormChildOverlayZIndex } from '@/components/reservation/ReservationFormModalStackContext'

const MOBILE_MORE_SHEET_MIN_Z = 10250

export type ReservationFormMobileSection = {
  id: string
  label: string
}

type StatusOption = {
  value: ReservationStatusCode
  label: string
}

type ReservationFormMobileChromeProps = {
  title: string
  status: string
  statusDisabled?: boolean
  statusOptions: StatusOption[]
  onStatusChange: (status: ReservationStatusCode) => void
  onClose: () => void
  sections: ReservationFormMobileSection[]
  moreActions?: ReactNode
}

function scrollToFormSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function ReservationFormMobileChrome({
  title,
  status,
  statusDisabled = false,
  statusOptions,
  onStatusChange,
  onClose,
  sections,
  moreActions,
}: ReservationFormMobileChromeProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const overlayZIndex = Math.max(useReservationFormChildOverlayZIndex(1200), MOBILE_MORE_SHEET_MIN_Z)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  return (
    <div className="lg:hidden flex-shrink-0">
      <div className="border-b border-slate-200 bg-white pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          {moreActions ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              aria-label="더 보기"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pb-2.5">
          <label className="sr-only" htmlFor="reservation-status-mobile-sheet">
            상태
          </label>
          <select
            id="reservation-status-mobile-sheet"
            value={status}
            disabled={statusDisabled}
            onChange={(e) => onStatusChange(e.target.value as ReservationStatusCode)}
            className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {sections.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToFormSection(section.id)}
                className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                {section.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {portalReady && moreActions
        ? createPortal(
            <div
              className={`fixed inset-0 lg:hidden ${moreOpen ? '' : 'hidden'}`}
              style={{ zIndex: overlayZIndex }}
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="닫기"
                onClick={() => setMoreOpen(false)}
              />
              <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-gray-200 bg-gray-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">추가 작업</p>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    aria-label="닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) setMoreOpen(false)
                  }}
                  className="grid grid-cols-4 gap-x-2 gap-y-4 [&_div.flex]:contents [&_[aria-hidden='true']]:!hidden [&_p]:col-span-4 [&_p]:m-0 [&_p]:px-0.5 [&_p]:pt-1 [&_p]:text-left [&_p]:text-[11px] [&_p]:font-medium [&_p]:normal-case [&_p]:tracking-normal [&_p]:text-gray-500 [&_p:first-child]:pt-0 [&_button]:!inline-flex [&_button]:!h-auto [&_button]:!min-h-0 [&_button]:!w-full [&_button]:!max-w-none [&_button]:flex-col [&_button]:items-center [&_button]:justify-start [&_button]:!gap-1.5 [&_button]:!rounded-none [&_button]:!border-0 [&_button]:!bg-transparent [&_button]:!p-0 [&_button]:!text-[11px] [&_button]:!font-medium [&_button]:!leading-tight [&_button]:!text-gray-800 [&_button]:!shadow-none [&_button]:active:scale-[0.98] [&_button>svg]:box-border [&_button>svg]:!h-14 [&_button>svg]:!w-14 [&_button>svg]:!rounded-2xl [&_button>svg]:!border [&_button>svg]:!border-slate-200 [&_button>svg]:!bg-white [&_button>svg]:!p-3.5 [&_button>svg]:!shadow-sm [&_button.bg-gray-50>svg]:!border-gray-200 [&_button.bg-gray-50>svg]:!bg-gray-100 [&_button.bg-slate-50>svg]:!border-slate-200 [&_button.bg-slate-50>svg]:!bg-slate-100 [&_button.bg-teal-50>svg]:!border-teal-200 [&_button.bg-teal-50>svg]:!bg-teal-50 [&_button.bg-teal-50>svg]:!text-teal-700 [&_button.bg-purple-50>svg]:!border-purple-200 [&_button.bg-purple-50>svg]:!bg-purple-50 [&_button.bg-purple-50>svg]:!text-purple-700 [&_button.bg-violet-50>svg]:!border-violet-200 [&_button.bg-violet-50>svg]:!bg-violet-50 [&_button.bg-violet-50>svg]:!text-violet-800 [&_button.text-indigo-700>svg]:!border-indigo-200 [&_button.text-indigo-700>svg]:!bg-indigo-50 [&_button.text-indigo-700>svg]:!text-indigo-700 [&_button:not(:has(svg))>span]:!whitespace-normal [&_button>span]:line-clamp-2 [&_button>span]:w-full [&_button>span]:text-center [&_button>span]:text-[11px] [&_button>span]:font-medium [&_button>span]:leading-tight [&_button>span]:text-gray-800 [&_button:not(:has(svg))>span]:flex [&_button:not(:has(svg))>span]:h-14 [&_button:not(:has(svg))>span]:w-14 [&_button:not(:has(svg))>span]:items-center [&_button:not(:has(svg))>span]:justify-center [&_button:not(:has(svg))>span]:rounded-2xl [&_button:not(:has(svg))>span]:border [&_button:not(:has(svg))>span]:border-slate-200 [&_button:not(:has(svg))>span]:bg-white [&_button:not(:has(svg))>span]:px-1 [&_button:not(:has(svg))>span]:text-[10px] [&_button:not(:has(svg))>span]:shadow-sm [&_button:has(>svg:only-child)]:after:line-clamp-2 [&_button:has(>svg:only-child)]:after:w-full [&_button:has(>svg:only-child)]:after:text-center [&_button:has(>svg:only-child)]:after:text-[11px] [&_button:has(>svg:only-child)]:after:font-medium [&_button:has(>svg:only-child)]:after:leading-tight [&_button:has(>svg:only-child)]:after:text-gray-800 [&_button:has(>svg:only-child)]:after:content-[attr(title)]"
                >
                  {moreActions}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

type ReservationFormMobileFooterProps = {
  formId: string
  saveLabel: string
  saveDisabled?: boolean
  saveTitle?: string
  cancelLabel: string
  onCancel: () => void
  deleteLabel?: string
  onDelete?: () => void
}

export function ReservationFormMobileFooter({
  formId,
  saveLabel,
  saveDisabled = false,
  saveTitle,
  cancelLabel,
  onCancel,
  deleteLabel,
  onDelete,
}: ReservationFormMobileFooterProps) {
  return (
    <div className="lg:hidden flex-shrink-0 border-t border-slate-200 bg-white px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center gap-2">
        {onDelete && deleteLabel ? (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            aria-label={deleteLabel}
            title={deleteLabel}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          form={formId}
          disabled={saveDisabled}
          title={saveTitle}
          className="inline-flex h-12 flex-[1.4] items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}
