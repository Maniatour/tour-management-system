'use client'

import { useEffect, useMemo, useState } from 'react'
import { Eye, Loader2, Send, Smartphone } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'
import {
  buildAdminSmsSamplePreview,
  getAdminSmsSamplePreviewNote,
} from '@/lib/adminSmsSamplePreview'

const SAMPLE_PHONE_STORAGE_KEY = 'admin-sms-sample-phone'

type Props = {
  categoryId: AdminSmsCategoryId
  locale: string
  bodyTpl: string
  uiLocale: string
}

export default function AdminSmsSamplePreviewPanel({
  categoryId,
  locale,
  bodyTpl,
  uiLocale,
}: Props) {
  const isKo = uiLocale.startsWith('ko')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAMPLE_PHONE_STORAGE_KEY)
      if (saved) setPhone(saved)
    } catch {
      /* ignore */
    }
  }, [])

  const preview = useMemo(
    () => buildAdminSmsSamplePreview({ categoryId, locale, bodyTpl }),
    [categoryId, locale, bodyTpl]
  )

  const canSend = !!bodyTpl.trim() && !!preview.trim() && !!phone.trim() && !sending

  const handleSendSample = async () => {
    if (!canSend) return
    setSending(true)
    setNotice(null)
    try {
      localStorage.setItem(SAMPLE_PHONE_STORAGE_KEY, phone.trim())
      const res = await fetchApiWithAuth('/api/admin-sms-sample-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          locale,
          bodyTemplate: bodyTpl,
          phone: phone.trim(),
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        details?: string
        toPhone?: string
      }
      if (!res.ok) {
        setNotice(
          data.details
            ? `${data.error || (isKo ? '발송 실패' : 'Send failed')}: ${data.details}`
            : data.error || (isKo ? '발송 실패' : 'Send failed')
        )
        return
      }
      setNotice(
        isKo
          ? `샘플 SMS를 ${data.toPhone ?? phone} 로 발송했습니다.`
          : `Sample SMS sent to ${data.toPhone ?? phone}.`
      )
    } catch {
      setNotice(isKo ? '발송 실패' : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  if (!bodyTpl.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-muted-foreground">
        {isKo ? '템플릿을 입력하면 샘플 미리보기가 표시됩니다.' : 'Enter a template to see sample preview.'}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-violet-600" aria-hidden />
          <h4 className="text-sm font-semibold text-gray-900">
            {isKo ? '샘플 미리보기' : 'Sample preview'}
          </h4>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px]">
          <label className="sr-only" htmlFor="admin-sms-sample-phone">
            {isKo ? '샘플 발송 전화번호' : 'Sample send phone number'}
          </label>
          <div className="flex gap-2">
            <input
              id="admin-sms-sample-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={isKo ? '+1 702... 또는 +82...' : '+1 702... or +82...'}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-violet-500"
              autoComplete="tel"
            />
            <button
              type="button"
              onClick={() => void handleSendSample()}
              disabled={!canSend}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden />
              )}
              {isKo ? '샘플 보내기' : 'Send sample'}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {isKo
              ? '샘플 데이터로 치환된 내용이 실제 SMS로 발송됩니다.'
              : 'Sends the sample-substituted message as a real SMS.'}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{getAdminSmsSamplePreviewNote(uiLocale)}</p>

      {notice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {notice}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-slate-100 to-slate-200 p-4">
        <div className="mx-auto max-w-md">
          <div className="mb-3 flex items-center justify-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            SMS
          </div>
          <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-900">
              {preview}
            </pre>
          </div>
          <p className="mt-2 text-right text-[10px] text-slate-500">
            {preview.length} {isKo ? '자' : 'chars'}
          </p>
        </div>
      </div>
    </div>
  )
}
