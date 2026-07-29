'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  abbreviateKlookVariantLabel,
  formatClosureHistoryActor,
  formatClosureHistoryDetail,
  formatOtaUpdateStamp,
  type ChannelVariantListing,
  type OtaChannelInventoryHistoryRow,
} from '@/lib/otaPriceInventory'

export type OtaClosureTeamMemberLite = {
  email: string
  nick_name?: string | null
  name_ko?: string | null
}

export function OtaClosureChannelButton({
  listing,
  faviconUrl,
  currentRemaining,
  saving,
  historyEntries,
  teamMembers,
  onMarkSynced,
}: {
  listing: ChannelVariantListing
  faviconUrl?: string
  currentRemaining: number
  saving: boolean
  historyEntries: OtaChannelInventoryHistoryRow[]
  teamMembers: OtaClosureTeamMemberLite[]
  onMarkSynced: () => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const hideTimerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [failed, setFailed] = useState(false)
  const isKlook = /klook|클룩/i.test(`${listing.channelId} ${listing.channelName}`)
  const variantBadge = isKlook
    ? abbreviateKlookVariantLabel(listing.variantKey, listing.variantLabel)
    : null

  const showPopover = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    setOpen(true)
  }, [])

  const scheduleHidePopover = useCallback(() => {
    hideTimerRef.current = window.setTimeout(() => setOpen(false), 140)
  }, [])

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setCoords({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    })
  }, [open])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed z-[12050] w-[min(92vw,240px)] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-white p-2.5 text-left shadow-xl"
            style={{ top: coords.top, left: coords.left }}
            onMouseEnter={showPopover}
            onMouseLeave={scheduleHidePopover}
            role="tooltip"
          >
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">{listing.displayLabel}</p>
            <p className="mb-1 text-[10px] text-muted-foreground">
              현재 잔여 <span className="font-semibold text-foreground">{currentRemaining}석</span>
            </p>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">OTA 반영 히스토리</p>
            {historyEntries.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">아직 기록이 없습니다.</p>
            ) : (
              <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                {historyEntries.slice(0, 10).map((entry, index) => (
                  <li
                    key={entry.id || `${entry.recorded_at}-${index}`}
                    className="rounded-md bg-slate-50 px-2 py-1"
                  >
                    <p className="text-[10px] font-semibold text-foreground">
                      {formatClosureHistoryActor(entry, teamMembers)}
                      <span className="ml-1 font-normal text-muted-foreground">
                        {formatOtaUpdateStamp(entry.recorded_at)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      {formatClosureHistoryDetail(entry)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body
        )
      : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!saving) onMarkSynced()
        }}
        disabled={saving}
        onMouseEnter={showPopover}
        onMouseLeave={scheduleHidePopover}
        onFocus={showPopover}
        onBlur={scheduleHidePopover}
        aria-label={`${listing.displayLabel} OTA 사이트 ${currentRemaining}석 반영 완료`}
        title={`클릭 → OTA 사이트에 ${currentRemaining}석 반영 완료`}
        className="inline-flex h-8 min-w-[2rem] flex-col items-center justify-center rounded-md border border-red-200 bg-red-50 px-1 py-0.5 shadow-sm transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
      >
        {saving ? (
          <span className="text-[9px] font-bold leading-none text-red-800">…</span>
        ) : faviconUrl && !failed ? (
          <img
            src={faviconUrl}
            alt=""
            className="h-[18px] w-[18px] shrink-0 rounded-sm object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-[10px] font-bold leading-none text-red-800">
            {isKlook ? 'K' : 'G'}
          </span>
        )}
        {!saving && variantBadge ? (
          <span className="mt-0.5 text-[8px] leading-none text-red-900">{variantBadge}</span>
        ) : null}
      </button>
      {popover}
    </>
  )
}
