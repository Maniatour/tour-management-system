'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  CreditCard,
  Loader2,
  Send,
  Copy,
  ExternalLink,
  CheckCircle2,
  Mail,
  X,
  History,
  RefreshCw,
} from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'

export type QuickPaymentFormInitials = {
  email?: string
  recipientName?: string
  description?: string
  amountUsd?: number | string
}

type QuickPaymentResult = {
  invoiceId: string
  invoiceNumber: string
  sitePayUrl: string
  hostedInvoiceUrl: string
  amountUsd: number
  description: string
  email: string
  emailSent: boolean
  emailError: string | null
  customerCreated: boolean
}

type QuickPaymentRequestFormProps = {
  locale?: 'ko' | 'en'
  initials?: QuickPaymentFormInitials
  /** page: 독립 페이지 / modal: 모달 본문 */
  variant?: 'page' | 'modal'
  onClose?: () => void
}

export default function QuickPaymentRequestForm({
  locale: localeProp,
  initials,
  variant = 'page',
  onClose,
}: QuickPaymentRequestFormProps) {
  const params = useParams()
  const locale = (localeProp ?? (params?.locale === 'en' ? 'en' : 'ko')) as 'ko' | 'en'
  const isModal = variant === 'modal'

  const [email, setEmail] = useState(initials?.email ?? '')
  const [recipientName, setRecipientName] = useState(initials?.recipientName ?? '')
  const [description, setDescription] = useState(initials?.description ?? '')
  const [amount, setAmount] = useState(
    initials?.amountUsd != null && initials.amountUsd !== ''
      ? String(initials.amountUsd)
      : ''
  )
  const [sendEmail, setSendEmail] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuickPaymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEmail(initials?.email ?? '')
    setRecipientName(initials?.recipientName ?? '')
    setDescription(initials?.description ?? '')
    setAmount(
      initials?.amountUsd != null && initials.amountUsd !== ''
        ? String(initials.amountUsd)
        : ''
    )
    setResult(null)
    setError(null)
    setSendEmail(true)
  }, [initials?.email, initials?.recipientName, initials?.description, initials?.amountUsd])

  const resetForm = () => {
    setEmail(initials?.email ?? '')
    setRecipientName(initials?.recipientName ?? '')
    setDescription(initials?.description ?? '')
    setAmount(
      initials?.amountUsd != null && initials.amountUsd !== ''
        ? String(initials.amountUsd)
        : ''
    )
    setSendEmail(true)
    setResult(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    const amountUsd = Number(amount)
    if (!email.trim()) {
      setError(locale === 'ko' ? '수신자 이메일을 입력해 주세요.' : 'Recipient email is required.')
      return
    }
    if (!description.trim()) {
      setError(locale === 'ko' ? '청구 내용을 입력해 주세요.' : 'Description is required.')
      return
    }
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      setError(locale === 'ko' ? '금액은 0보다 커야 합니다.' : 'Amount must be greater than zero.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetchApiWithAuth('/api/invoices/quick-payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          recipientName: recipientName.trim() || undefined,
          description: description.trim(),
          amountUsd,
          locale,
          sendEmail,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || (locale === 'ko' ? '청구 실패' : 'Request failed'))
      }
      setResult({
        invoiceId: String(data.invoiceId),
        invoiceNumber: String(data.invoiceNumber),
        sitePayUrl: String(data.sitePayUrl || ''),
        hostedInvoiceUrl: String(data.hostedInvoiceUrl || ''),
        amountUsd: Number(data.amountUsd),
        description: String(data.description),
        email: String(data.email),
        emailSent: Boolean(data.emailSent),
        emailError: data.emailError ? String(data.emailError) : null,
        customerCreated: Boolean(data.customerCreated),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === 'ko' ? '오류가 발생했습니다.' : 'An error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyPayUrl = async () => {
    const url = result?.sitePayUrl || result?.hostedInvoiceUrl
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      alert(locale === 'ko' ? '결제 링크가 복사되었습니다.' : 'Payment link copied.')
    } catch {
      alert(url)
    }
  }

  const body = (
    <>
      {!isModal && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {locale === 'ko' ? '빠른 금액 청구' : 'Quick Payment Request'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {locale === 'ko'
              ? '금액, 내용, 수신 이메일을 입력하면 Stripe 카드 결제 링크를 만들고 이메일로 보냅니다.'
              : 'Enter amount, description, and recipient email to create a Stripe card payment link and email it.'}
          </p>
        </div>
      )}

      {result ? (
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">
                {locale === 'ko' ? '결제 요청이 준비되었습니다' : 'Payment request ready'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.invoiceNumber} · ${result.amountUsd.toFixed(2)} · {result.email}
              </p>
              {result.emailSent ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700">
                  <Mail className="h-4 w-4" aria-hidden />
                  {locale === 'ko' ? '이메일을 발송했습니다.' : 'Email sent.'}
                </p>
              ) : result.emailError ? (
                <p className="mt-2 text-sm text-amber-700">{result.emailError}</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {locale === 'ko' ? '이메일은 보내지 않았습니다.' : 'Email was not sent.'}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm break-all">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {locale === 'ko' ? '결제 링크' : 'Payment link'}
            </p>
            {result.sitePayUrl || result.hostedInvoiceUrl}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyPayUrl}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {locale === 'ko' ? '링크 복사' : 'Copy link'}
            </button>
            <a
              href={result.sitePayUrl || result.hostedInvoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {locale === 'ko' ? '링크 열기' : 'Open link'}
            </a>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {locale === 'ko' ? '새 청구 작성' : 'New request'}
            </button>
            {isModal && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
              >
                {locale === 'ko' ? '닫기' : 'Close'}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className={
            isModal
              ? 'space-y-5'
              : 'rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-5'
          }
        >
          <div className="space-y-2">
            <label htmlFor="qp-email" className="text-sm font-medium text-foreground">
              {locale === 'ko' ? '수신자 이메일' : 'Recipient email'}
            </label>
            <input
              id="qp-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="guest@example.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="qp-name" className="text-sm font-medium text-foreground">
              {locale === 'ko' ? '수신자 이름 (선택)' : 'Recipient name (optional)'}
            </label>
            <input
              id="qp-name"
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={locale === 'ko' ? '홍길동' : 'Guest name'}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="qp-amount" className="text-sm font-medium text-foreground">
              {locale === 'ko' ? '금액 (USD)' : 'Amount (USD)'}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                id="qp-amount"
                type="number"
                required
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background pl-7 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="199.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="qp-desc" className="text-sm font-medium text-foreground">
              {locale === 'ko' ? '내용' : 'Description'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { value: 'Non-Resident Fee', labelKo: 'Non-Resident Fee', labelEn: 'Non-Resident Fee' },
                  { value: 'Tour Balance', labelKo: 'Tour Balance', labelEn: 'Tour Balance' },
                  { value: 'Guide Tips', labelKo: 'Guide Tips', labelEn: 'Guide Tips' },
                ] as const
              ).map((preset) => {
                const active = description.trim() === preset.value
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setDescription(preset.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-border bg-background text-foreground hover:border-teal-600 hover:text-teal-700'
                    }`}
                    aria-pressed={active}
                  >
                    {locale === 'ko' ? preset.labelKo : preset.labelEn}
                  </button>
                )
              })}
            </div>
            <textarea
              id="qp-desc"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              placeholder={
                locale === 'ko'
                  ? '예: Non-Resident Fee, Tour Balance, Guide Tips'
                  : 'e.g. Non-Resident Fee, Tour Balance, Guide Tips'
              }
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {locale === 'ko'
              ? 'Stripe 결제 링크를 이메일로 보내기'
              : 'Email the Stripe payment link'}
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                {locale === 'ko' ? '처리 중…' : 'Processing…'}
              </>
            ) : (
              <>
                {sendEmail ? <Send className="h-5 w-5" aria-hidden /> : <CreditCard className="h-5 w-5" aria-hidden />}
                {sendEmail
                  ? locale === 'ko'
                    ? '청구하고 이메일 보내기'
                    : 'Charge & send email'
                  : locale === 'ko'
                    ? '결제 링크만 만들기'
                    : 'Create payment link only'}
              </>
            )}
          </button>
        </form>
      )}
    </>
  )

  if (isModal) {
    return <div className="space-y-4">{body}</div>
  }

  return <div className="mx-auto max-w-xl space-y-6">{body}</div>
}

type QuickPaymentRequestModalProps = {
  open: boolean
  onClose: () => void
  locale?: 'ko' | 'en'
  initials?: QuickPaymentFormInitials
}

type HistoryItem = {
  id: string
  invoiceNumber: string
  status: string
  total: number
  description: string
  email: string
  recipientName: string
  createdAt: string | null
  sentAt: string | null
  paidAt: string | null
  createdBy: string | null
  sitePayUrl: string | null
  hostedInvoiceUrl: string | null
  stripeInvoiceStatus: string | null
}

function statusLabel(status: string, locale: 'ko' | 'en'): string {
  const s = status.toLowerCase()
  if (locale === 'ko') {
    if (s === 'paid') return '결제완료'
    if (s === 'sent') return '발송됨'
    if (s === 'cancelled' || s === 'canceled') return '취소'
    if (s === 'draft') return '초안'
    return status
  }
  if (s === 'paid') return 'Paid'
  if (s === 'sent') return 'Sent'
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled'
  if (s === 'draft') return 'Draft'
  return status
}

function statusClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'paid') return 'bg-green-100 text-green-800'
  if (s === 'sent') return 'bg-blue-100 text-blue-800'
  if (s === 'cancelled' || s === 'canceled') return 'bg-gray-100 text-gray-600'
  return 'bg-amber-100 text-amber-900'
}

function formatHistoryDate(raw: string | null, locale: 'ko' | 'en'): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function QuickPaymentHistoryPanel({
  locale,
  onReuse,
}: {
  locale: 'ko' | 'en'
  onReuse: (item: HistoryItem) => void
}) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchApiWithAuth(
        `/api/invoices/quick-payment-request?locale=${locale}&limit=50`
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || (locale === 'ko' ? '내역 로드 실패' : 'Failed to load history'))
      }
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === 'ko' ? '오류' : 'Error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [locale])

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      alert(locale === 'ko' ? '결제 링크가 복사되었습니다.' : 'Payment link copied.')
    } catch {
      alert(url)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        {locale === 'ko' ? '내역을 불러오는 중…' : 'Loading history…'}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          {locale === 'ko' ? '다시 시도' : 'Retry'}
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {locale === 'ko' ? '아직 청구한 내역이 없습니다.' : 'No payment requests yet.'}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {locale === 'ko' ? `최근 ${items.length}건` : `Latest ${items.length}`}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          {locale === 'ko' ? '새로고침' : 'Refresh'}
        </button>
      </div>
      <ul className="max-h-[min(55vh,28rem)] space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const payUrl = item.sitePayUrl || item.hostedInvoiceUrl
          return (
            <li
              key={item.id}
              className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      ${item.total.toFixed(2)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(item.status)}`}
                    >
                      {statusLabel(item.status, locale)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{item.invoiceNumber}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-foreground" title={item.description}>
                    {item.description}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.recipientName ? `${item.recipientName} · ` : ''}
                    {item.email || '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {locale === 'ko' ? '생성' : 'Created'}: {formatHistoryDate(item.createdAt, locale)}
                    {item.paidAt
                      ? ` · ${locale === 'ko' ? '결제' : 'Paid'}: ${formatHistoryDate(item.paidAt, locale)}`
                      : item.sentAt
                        ? ` · ${locale === 'ko' ? '발송' : 'Sent'}: ${formatHistoryDate(item.sentAt, locale)}`
                        : ''}
                  </p>
                  {item.createdBy ? (
                    <p className="text-[11px] text-muted-foreground">
                      {locale === 'ko' ? '담당' : 'By'}: {item.createdBy}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {payUrl && item.status.toLowerCase() !== 'paid' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void copyUrl(payUrl)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs hover:bg-muted"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      {locale === 'ko' ? '링크 복사' : 'Copy'}
                    </button>
                    <a
                      href={payUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs hover:bg-muted"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      {locale === 'ko' ? '열기' : 'Open'}
                    </a>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => onReuse(item)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-teal-600 px-2.5 text-xs text-teal-700 hover:bg-teal-50"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {locale === 'ko' ? '다시 청구' : 'Charge again'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function QuickPaymentRequestModal({
  open,
  onClose,
  locale = 'ko',
  initials,
}: QuickPaymentRequestModalProps) {
  const [view, setView] = useState<'form' | 'history'>('form')
  const [formInitials, setFormInitials] = useState<QuickPaymentFormInitials | undefined>(initials)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (!open) return
    setView('form')
    setFormInitials(initials)
    setFormKey((k) => k + 1)
  }, [open, initials?.email, initials?.recipientName, initials?.description, initials?.amountUsd])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={locale === 'ko' ? '빠른 금액 청구' : 'Quick Payment Request'}
    >
      <div
        className={`relative w-full max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-lg ${
          view === 'history' ? 'max-w-2xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {locale === 'ko' ? '빠른 금액 청구' : 'Quick Payment Request'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {view === 'history'
                ? locale === 'ko'
                  ? '이전에 청구한 Stripe 결제 요청 내역입니다.'
                  : 'Previous Stripe payment requests.'
                : locale === 'ko'
                  ? '금액·내용·이메일로 Stripe 카드 결제를 요청합니다.'
                  : 'Request a Stripe card payment with amount, description, and email.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setView(view === 'history' ? 'form' : 'history')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === 'history'
                  ? 'bg-teal-600 text-white'
                  : 'border border-teal-600 text-teal-700 hover:bg-teal-50'
              }`}
              aria-pressed={view === 'history'}
            >
              <History className="h-3.5 w-3.5" aria-hidden />
              {view === 'history'
                ? locale === 'ko'
                  ? '새 청구'
                  : 'New'
                : locale === 'ko'
                  ? '히스토리'
                  : 'History'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={locale === 'ko' ? '닫기' : 'Close'}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {view === 'history' ? (
          <QuickPaymentHistoryPanel
            locale={locale}
            onReuse={(item) => {
              const next: QuickPaymentFormInitials = {
                email: item.email,
                recipientName: item.recipientName,
                description: item.description,
              }
              if (item.total > 0) next.amountUsd = item.total
              setFormInitials(next)
              setFormKey((k) => k + 1)
              setView('form')
            }}
          />
        ) : (
          <QuickPaymentRequestForm
            key={formKey}
            locale={locale}
            {...(formInitials ? { initials: formInitials } : {})}
            variant="modal"
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
