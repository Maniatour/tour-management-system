'use client'

import { useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchLatestResidentCheckGuestRecord,
  type ResidentCheckGuestRecord,
} from '@/lib/residentCheckReservationSync'
import ResidentCheckSubmissionModal from '@/components/reservation/ResidentCheckSubmissionModal'

export default function GuestResidentCheckCardButton({
  reservationId,
  guestName,
  tourDate,
  locale = 'ko',
}: {
  reservationId: string
  guestName?: string
  tourDate?: string
  locale?: string
}) {
  const isKo = locale === 'ko'
  const [open, setOpen] = useState(false)
  const [record, setRecord] = useState<ResidentCheckGuestRecord | null>(null)
  const [loading, setLoading] = useState(false)

  const title = isKo ? '게스트 거주 확인 폼' : 'Guest residency form'

  const handleClick = async (e: MouseEvent) => {
    e.stopPropagation()
    if (record) {
      setOpen(true)
      return
    }
    setLoading(true)
    try {
      const next = await fetchLatestResidentCheckGuestRecord(supabase, reservationId)
      if (next) {
        setRecord(next)
        setOpen(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-violet-700 hover:bg-violet-50 disabled:opacity-50"
        title={title}
        aria-label={title}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && record && typeof document !== 'undefined'
        ? createPortal(
            <ResidentCheckSubmissionModal
              record={record}
              guestName={guestName || ''}
              tourDate={tourDate || ''}
              locale={locale}
              onClose={() => setOpen(false)}
            />,
            document.body
          )
        : null}
    </>
  )
}
