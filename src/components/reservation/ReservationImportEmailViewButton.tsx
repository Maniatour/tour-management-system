'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MailOpen, X } from 'lucide-react'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useReservationFormChildOverlayZIndex } from '@/components/reservation/ReservationFormModalStackContext'
import { ImportedEmailBodyPanel } from '@/components/reservation/ImportedEmailBodyPanel'

type ImportEmailRow = {
  id: string
  subject: string | null
  source_email: string | null
  raw_body_text: string | null
  raw_body_html: string | null
}

export function ReservationImportEmailViewButton({ reservationId }: { reservationId: string }) {
  const locale = useLocale()
  const overlayZIndex = useReservationFormChildOverlayZIndex(1300)
  const isEn = locale.startsWith('en')
  const [hasImport, setHasImport] = useState(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [row, setRow] = useState<ImportEmailRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const labels = useMemo(
    () =>
      isEn
        ? {
            button: 'Source email',
            title: 'Imported email body',
            preview: 'Preview',
            code: 'Code',
            empty: 'Email body could not be displayed.',
            missing: 'No imported email body is linked to this reservation.',
            loadError: 'Could not load the email body.',
          }
        : {
            button: '이메일 본문',
            title: '이메일 본문',
            preview: '미리보기',
            code: '코드',
            empty: '본문을 표시할 수 없습니다.',
            missing: '이 예약에 연결된 가져오기 이메일이 없습니다.',
            loadError: '이메일 본문을 불러오지 못했습니다.',
          },
    [isEn]
  )

  useEffect(() => {
    let cancelled = false
    const id = String(reservationId || '').trim()
    if (!id || id.startsWith('import-')) {
      setHasImport(false)
      setRow(null)
      setOpen(false)
      return
    }
    setRow(null)
    void (async () => {
      const { data } = await supabase
        .from('reservation_imports')
        .select('id')
        .eq('reservation_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (cancelled) return
      const row = Array.isArray(data) ? data[0] : data
      setHasImport(Boolean(row && (row as { id?: string }).id))
    })()
    return () => {
      cancelled = true
    }
  }, [reservationId])

  const loadBody = useCallback(async () => {
    const id = String(reservationId || '').trim()
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('reservation_imports')
        .select('id, subject, source_email, raw_body_text, raw_body_html')
        .eq('reservation_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (qErr) {
        setError(labels.loadError)
        setRow(null)
        return
      }
      const found = (Array.isArray(data) ? data[0] : data) as ImportEmailRow | null
      if (!found?.id) {
        setError(labels.missing)
        setRow(null)
        return
      }
      setRow(found)
    } finally {
      setLoading(false)
    }
  }, [labels.loadError, labels.missing, reservationId])

  const handleOpen = useCallback(() => {
    setOpen(true)
    if (!row) {
      setLoading(true)
      void loadBody()
    }
  }, [loadBody, row])

  if (!hasImport) return null

  const modal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: overlayZIndex }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="닫기"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-email-body-title"
              className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <h3
                    id="import-email-body-title"
                    className="text-sm font-semibold text-gray-900"
                  >
                    {labels.title}
                  </h3>
                  {row?.subject ? (
                    <p className="mt-0.5 truncate text-xs text-gray-500">{row.subject}</p>
                  ) : null}
                  {row?.source_email ? (
                    <p className="truncate text-[11px] text-gray-400">{row.source_email}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {loading ? (
                <div className="flex h-64 items-center justify-center text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : error ? (
                <p className="p-6 text-sm text-gray-600">{error}</p>
              ) : row ? (
                <ImportedEmailBodyPanel
                  text={row.raw_body_text}
                  html={row.raw_body_html}
                  previewLabel={labels.preview}
                  codeLabel={labels.code}
                  emptyLabel={labels.empty}
                />
              ) : null}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-gray-700 transition-colors hover:bg-gray-100"
        title={labels.button}
        aria-label={labels.button}
      >
        <MailOpen className="h-4 w-4" />
      </button>
      {modal}
    </>
  )
}
