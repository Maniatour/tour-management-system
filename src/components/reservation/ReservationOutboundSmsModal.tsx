'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Send, Smartphone, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import {
  resolveAdminSmsCategoryLabel,
} from '@/lib/adminSmsCategorySettings'
import { useAdminSmsCategorySettings } from '@/hooks/useAdminSmsCategorySettings'
import {
  customerSmsLocaleLabel,
  resolveCustomerSmsLocale,
} from '@/lib/reservationEmailLocale'
import type { ReservationOutboundSmsCategoryId } from '@/lib/reservationOutboundSmsCategories'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'

type PreviewData = {
  categoryId: ReservationOutboundSmsCategoryId
  locale: string
  message: string
  bodyTemplate: string
  savedInDb: boolean
  toPhone: string | null
  toPhoneDisplay: string
  customerName: string
  availableLocales: readonly string[]
}

type Props = {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  categoryId: ReservationOutboundSmsCategoryId
  customerLanguage: string | null | undefined
  sentBy: string | null
  uiLocale?: 'ko' | 'en'
  onSendSuccess?: () => void
}

export default function ReservationOutboundSmsModal({
  isOpen,
  onClose,
  reservationId,
  categoryId,
  customerLanguage,
  sentBy,
  uiLocale = 'ko',
  onSendSuccess,
}: Props) {
  const isEn = uiLocale === 'en'
  const { settings } = useAdminSmsCategorySettings({ enabled: isOpen })
  const smsLocale = resolveCustomerSmsLocale(customerLanguage, null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const categoryLabel = resolveAdminSmsCategoryLabel(categoryId, settings, uiLocale)
  const customerLanguageLabel = customerSmsLocaleLabel(smsLocale, uiLocale)

  useEffect(() => {
    if (!isOpen) setNotice(null)
  }, [isOpen])

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const res = await fetchApiWithAuth('/api/preview-reservation-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          categoryId,
          locale: smsLocale,
        }),
      })
      const data = (await res.json()) as PreviewData & { error?: string }
      if (!res.ok) {
        setPreview(null)
        setNotice(data.error || (isEn ? 'Failed to load preview.' : '미리보기를 불러오지 못했습니다.'))
        return
      }
      setPreview(data)
    } catch {
      setPreview(null)
      setNotice(isEn ? 'Failed to load preview.' : '미리보기를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [reservationId, categoryId, smsLocale, isEn])

  useEffect(() => {
    if (!isOpen) return
    void loadPreview()
  }, [isOpen, loadPreview])

  const handleSend = async () => {
    if (!preview?.toPhone) return
    setSending(true)
    setNotice(null)
    try {
      const res = await fetchApiWithAuth('/api/send-reservation-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          categoryId,
          locale: smsLocale,
          sentBy,
        }),
      })
      const data = (await res.json()) as { error?: string; details?: string }
      if (!res.ok) {
        setNotice(
          data.details
            ? `${data.error || (isEn ? 'Send failed.' : 'SMS 발송에 실패했습니다.')}: ${data.details}`
            : data.error || (isEn ? 'Send failed.' : 'SMS 발송에 실패했습니다.')
        )
        return
      }
      setNotice(isEn ? 'SMS sent successfully.' : 'SMS가 발송되었습니다.')
      onSendSuccess?.()
      window.setTimeout(() => onClose(), 600)
    } catch {
      setNotice(isEn ? 'Send failed.' : 'SMS 발송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  const previewBlocked = loading || !preview?.message

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: DIALOG_Z_INDEX.elevated }}
      onClick={onClose}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 shrink-0 text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{categoryLabel}</h2>
              <p className="text-xs text-muted-foreground">
                {preview?.customerName
                  ? `${preview.customerName} · ${preview.toPhoneDisplay || '—'}`
                  : isEn
                    ? 'Loading…'
                    : '불러오는 중…'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-gray-100 bg-slate-50 px-4 py-2">
          <p className="text-xs text-gray-600">
            {isEn ? 'Customer language' : '고객 언어'}:{' '}
            <span className="font-semibold text-violet-700">{customerLanguageLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={previewBlocked || sending || !preview?.toPhone}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isEn ? 'Send SMS' : 'SMS 발송'}
          </button>
          {preview?.savedInDb ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
              {isEn ? 'Saved template' : '저장된 템플릿'}
            </span>
          ) : (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">
              {isEn ? 'Default template' : '기본 템플릿'}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {notice ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {notice}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-slate-100 to-slate-200 p-4">
              <pre className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white px-4 py-3 font-sans text-sm leading-relaxed text-gray-900 shadow-sm">
                {preview?.message || (isEn ? 'No preview.' : '미리보기 없음')}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
