'use client'

import { useCallback, useEffect, useState } from 'react'
import { StickyNote, X } from 'lucide-react'

type Props = {
  open: boolean
  dateYmd: string | null
  initialNote: string
  locale: string
  saving?: boolean
  deleting?: boolean
  onClose: () => void
  onSave: (note: string) => Promise<void>
  onDelete: () => Promise<void>
}

function formatNoteDateLabel(dateYmd: string, locale: string): string {
  const [y, m, d] = dateYmd.split('-').map(Number)
  if (!y || !m || !d) return dateYmd
  const date = new Date(y, m - 1, d)
  try {
    return new Intl.DateTimeFormat(locale.startsWith('ko') ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(date)
  } catch {
    return dateYmd
  }
}

export default function TicketBookingDateNoteModal({
  open,
  dateYmd,
  initialNote,
  locale,
  saving = false,
  deleting = false,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const isKo = locale.startsWith('ko')
  const [noteText, setNoteText] = useState('')
  const hasExistingNote = initialNote.trim().length > 0
  const busy = saving || deleting

  useEffect(() => {
    if (open) setNoteText(initialNote)
  }, [open, initialNote])

  const handleSave = useCallback(async () => {
    if (busy) return
    await onSave(noteText)
  }, [busy, noteText, onSave])

  const handleDelete = useCallback(async () => {
    if (!onDelete || busy || !hasExistingNote) return
    const ok = window.confirm(
      isKo ? '이 날짜의 노트를 삭제할까요?' : 'Delete the note for this date?'
    )
    if (!ok) return
    await onDelete()
  }, [busy, hasExistingNote, isKo, onDelete])

  if (!open || !dateYmd) return null

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-booking-date-note-title"
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <StickyNote className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3
                id="ticket-booking-date-note-title"
                className="text-lg font-semibold text-gray-900"
              >
                {isKo ? '날짜 노트' : 'Date note'}
              </h3>
              <p className="mt-0.5 text-sm text-gray-600">
                {formatNoteDateLabel(dateYmd, locale)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-2 block text-sm font-medium text-gray-700">
          {isKo ? '노트 내용' : 'Note'}
        </label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={6}
          disabled={busy}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
          placeholder={
            isKo
              ? '예: 극성수기로 X 마감'
              : 'e.g. Peak season — X sold out / closed'
          }
          autoFocus
        />

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            {hasExistingNote ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy}
                className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (isKo ? '삭제 중…' : 'Deleting…') : isKo ? '삭제' : 'Delete'}
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {isKo ? '취소' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? (isKo ? '저장 중…' : 'Saving…') : isKo ? '저장' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
