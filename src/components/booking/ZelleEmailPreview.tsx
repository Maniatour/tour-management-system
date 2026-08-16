'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'

type ZelleEmailPayload = {
  id: string
  subject: string | null
  receivedAt: string | null
  html: string | null
  text: string | null
  parsed: {
    amount: number | null
    recipient: string | null
    paymentDateYmd: string | null
    confirmationNumber: string | null
    memo: string | null
    rnNumbers: string[]
    invoiceNumbers: string[]
  }
}

function formatUsd(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function ZelleEmailBodyView({
  importId,
  locale,
}: {
  importId: string
  locale: string
}) {
  const ko = locale === 'ko'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ZelleEmailPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetchApiWithAuth(`/api/admin/ticket-bookings/zelle-email/${importId}`)
        const json = (await res.json().catch(() => ({}))) as ZelleEmailPayload & { error?: string }
        if (!res.ok) throw new Error(json.error || res.statusText)
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [importId])

  if (loading) {
    return (
      <p className="flex items-center gap-2 px-3 py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {ko ? '메일 불러오는 중…' : 'Loading email…'}
      </p>
    )
  }
  if (error || !data) {
    return <p className="px-3 py-6 text-sm text-rose-700">{error || (ko ? '메일이 없습니다.' : 'Email not found.')}</p>
  }

  const srcDoc = data.html
    ? data.html.replace(/<script[\s\S]*?<\/script>/gi, '')
        : `<pre style="white-space:pre-wrap;font:14px/1.5 system-ui,sans-serif;padding:16px">${(data.text || (ko ? '본문이 없습니다.' : 'No body.'))
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')}</pre>`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-1 border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">{data.subject || 'You sent money with Zelle'}</p>
        <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-600">
          {formatUsd(data.parsed.amount) ? <span className="font-semibold">{formatUsd(data.parsed.amount)}</span> : null}
          {data.parsed.recipient ? <span>{data.parsed.recipient}</span> : null}
          {data.parsed.paymentDateYmd ? <span>{data.parsed.paymentDateYmd}</span> : null}
          {data.parsed.confirmationNumber ? <span>Conf {data.parsed.confirmationNumber}</span> : null}
          {data.parsed.memo ? <span>Memo {data.parsed.memo}</span> : null}
        </p>
      </div>
      <iframe
        title={data.subject || 'Zelle email'}
        sandbox=""
        srcDoc={srcDoc}
        className="min-h-[420px] w-full flex-1 bg-white"
      />
    </div>
  )
}

export default function ZelleEmailPreviewModal({
  open,
  importId,
  locale,
  onClose,
  overlayClassName,
}: {
  open: boolean
  importId: string | null
  locale: string
  onClose: () => void
  /** 다른 모달 위에 올릴 때 z-index 클래스 */
  overlayClassName?: string
}) {
  const ko = locale === 'ko'
  if (!open || !importId) return null
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/60 p-3 ${overlayClassName ?? 'z-[220]'}`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-gray-900">{ko ? 'Zelle 송금 메일' : 'Zelle payment email'}</h3>
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={ko ? '닫기' : 'Close'}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ZelleEmailBodyView importId={importId} locale={locale} />
      </div>
    </div>
  )
}
