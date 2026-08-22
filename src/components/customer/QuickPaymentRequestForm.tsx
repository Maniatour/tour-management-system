'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  TriangleAlert,
  Smartphone,
} from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { childModalZIndex, DIALOG_Z_INDEX } from '@/lib/dialogZIndex'
import { isGetYourGuideReplyEmail } from '@/lib/otaDirectCustomerEmail'
import {
  buildQuickPaymentRequestSmsText,
  buildWhatsAppMeUrl,
} from '@/lib/quickPaymentRequestMessage'
import { resolveSmsPhone } from '@/utils/formatPhoneToE164'
import {
  useReservationFormChildOverlayZIndex,
  useReservationFormGrandchildOverlayZIndex,
} from '@/components/reservation/ReservationFormModalStackContext'

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export type QuickPaymentFormInitials = {
  email?: string
  phone?: string
  recipientName?: string
  description?: string
  amountUsd?: number | string
  reservationId?: string
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
  customerEmailUpdated: boolean
  previousEmail: string | null
  specialRequests: string | null
  smsSent: boolean
  smsError: string | null
  smsToPhone: string | null
}

export type QuickPaymentCustomerContactUpdate = {
  email: string
  specialRequests: string | null
  previousEmail: string | null
}

type QuickPaymentRequestFormProps = {
  locale?: 'ko' | 'en'
  initials?: QuickPaymentFormInitials | undefined
  /** page: 독립 페이지 / modal: 모달 본문 */
  variant?: 'page' | 'modal'
  onClose?: () => void
  /** 빠른 금액 청구 모달 오버레이 z-index. 수수료 확인창은 이 위에 띄움 */
  overlayZIndex?: number
  onCustomerContactUpdated?: (payload: QuickPaymentCustomerContactUpdate) => void
}

export default function QuickPaymentRequestForm({
  locale: localeProp,
  initials,
  variant = 'page',
  onClose,
  overlayZIndex,
  onCustomerContactUpdated,
}: QuickPaymentRequestFormProps) {
  const params = useParams()
  const locale = (localeProp ?? (params?.locale === 'en' ? 'en' : 'ko')) as 'ko' | 'en'
  const isModal = variant === 'modal'
  const stackedConfirmZIndex = useReservationFormGrandchildOverlayZIndex(DIALOG_Z_INDEX.elevated)
  const confirmZIndex =
    overlayZIndex != null ? childModalZIndex(overlayZIndex) : stackedConfirmZIndex

  const [email, setEmail] = useState(initials?.email ?? '')
  const [recipientName, setRecipientName] = useState(initials?.recipientName ?? '')
  const [description, setDescription] = useState(initials?.description ?? '')
  const [amount, setAmount] = useState(
    initials?.amountUsd != null && initials.amountUsd !== ''
      ? String(initials.amountUsd)
      : ''
  )
  const [phone, setPhone] = useState(initials?.phone ?? '')
  const [sendEmail, setSendEmail] = useState(true)
  const [sendSms, setSendSms] = useState(false)
  const [openWhatsAppAfterCreate, setOpenWhatsAppAfterCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuickPaymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCardFeeConfirm, setShowCardFeeConfirm] = useState(false)
  const [savingCustomerEmail, setSavingCustomerEmail] = useState(false)
  const [customerEmailSaved, setCustomerEmailSaved] = useState(false)
  const [smsSending, setSmsSending] = useState(false)

  useEffect(() => {
    // 모달이 새로 열리며 initials가 바뀔 때만 필드 동기화 (제출 중/결과 화면에서 리셋되지 않도록)
    setEmail(initials?.email ?? '')
    setRecipientName(initials?.recipientName ?? '')
    setDescription(initials?.description ?? '')
    setAmount(
      initials?.amountUsd != null && initials.amountUsd !== ''
        ? String(initials.amountUsd)
        : ''
    )
    setPhone(initials?.phone ?? '')
    setResult(null)
    setError(null)
    setSendEmail(true)
    setSendSms(false)
    setOpenWhatsAppAfterCreate(false)
    setShowCardFeeConfirm(false)
    setCustomerEmailSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount via key handles open; avoid wiping result on parent re-renders
  }, [initials?.email, initials?.recipientName, initials?.description, initials?.amountUsd, initials?.reservationId, initials?.phone])

  useEffect(() => {
    if (!showCardFeeConfirm) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setShowCardFeeConfirm(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [showCardFeeConfirm])

  const resetForm = () => {
    setEmail(initials?.email ?? '')
    setRecipientName(initials?.recipientName ?? '')
    setDescription(initials?.description ?? '')
    setAmount(
      initials?.amountUsd != null && initials.amountUsd !== ''
        ? String(initials.amountUsd)
        : ''
    )
    setPhone(initials?.phone ?? '')
    setSendEmail(true)
    setSendSms(false)
    setOpenWhatsAppAfterCreate(false)
    setResult(null)
    setError(null)
    setShowCardFeeConfirm(false)
    setCustomerEmailSaved(false)
  }

  const validateBeforeSubmit = (): number | null => {
    setError(null)
    setResult(null)

    const amountUsd = Number(amount)
    if (!email.trim()) {
      setError(locale === 'ko' ? '수신자 이메일을 입력해 주세요.' : 'Recipient email is required.')
      return null
    }
    if (isGetYourGuideReplyEmail(email)) {
      setError(
        locale === 'ko'
          ? 'GetYourGuide 임시 이메일(@reply.getyourguide.com)로는 금액 청구를 보낼 수 없습니다. 고객의 실제 이메일을 입력해 주세요.'
          : 'GetYourGuide relay addresses (@reply.getyourguide.com) cannot receive payment requests. Enter the guest\'s real email.'
      )
      return null
    }
    if (!description.trim()) {
      setError(locale === 'ko' ? '청구 내용을 입력해 주세요.' : 'Description is required.')
      return null
    }
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      setError(locale === 'ko' ? '금액은 0보다 커야 합니다.' : 'Amount must be greater than zero.')
      return null
    }
    if ((sendSms || openWhatsAppAfterCreate) && !resolveSmsPhone(phone)) {
      setError(
        locale === 'ko'
          ? '문자/WhatsApp으로 보내려면 유효한 전화번호를 입력해 주세요.'
          : 'Enter a valid phone number to send by SMS or WhatsApp.'
      )
      return null
    }
    return amountUsd
  }

  const handleSubmitClick = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (submitting) return

    if (validateBeforeSubmit() == null) return

    if (sendEmail || sendSms || openWhatsAppAfterCreate) {
      setShowCardFeeConfirm(true)
      return
    }
    void submitPaymentRequest()
  }

  const handleUpdateCustomerEmail = async () => {
    setError(null)
    const nextEmail = email.trim()
    const reservationId = initials?.reservationId?.trim() || ''
    if (!reservationId) {
      setError(
        locale === 'ko'
          ? '예약에 연결된 고객만 이메일을 업데이트할 수 있습니다.'
          : 'Customer email can only be updated from a reservation.'
      )
      return
    }
    if (!nextEmail) {
      setError(locale === 'ko' ? '수신자 이메일을 입력해 주세요.' : 'Recipient email is required.')
      return
    }
    if (isGetYourGuideReplyEmail(nextEmail)) {
      setError(
        locale === 'ko'
          ? 'GetYourGuide 임시 이메일(@reply.getyourguide.com)로는 금액 청구를 보낼 수 없습니다. 고객의 실제 이메일을 입력해 주세요.'
          : 'GetYourGuide relay addresses (@reply.getyourguide.com) cannot receive payment requests. Enter the guest\'s real email.'
      )
      return
    }
    if (savingCustomerEmail) return
    setSavingCustomerEmail(true)
    try {
      const response = await fetchApiWithAuth('/api/invoices/quick-payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateCustomerEmailOnly: true,
          email: nextEmail,
          recipientName: recipientName.trim() || undefined,
          reservationId,
          locale,
        }),
      })
      const data = await response.json().catch(() => ({} as Record<string, unknown>))
      if (!response.ok) {
        throw new Error(
          (typeof data.error === 'string' && data.error) ||
            (locale === 'ko' ? '고객 이메일 업데이트 실패' : 'Failed to update customer email')
        )
      }
      setCustomerEmailSaved(true)
      onCustomerContactUpdated?.({
        email: String(data.email || nextEmail),
        specialRequests:
          typeof data.specialRequests === 'string' ? data.specialRequests : null,
        previousEmail: data.previousEmail ? String(data.previousEmail) : null,
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === 'ko'
            ? '오류가 발생했습니다.'
            : 'An error occurred.'
      )
    } finally {
      setSavingCustomerEmail(false)
    }
  }

  const submitPaymentRequest = async () => {
    if (submitting) return

    const amountUsd = validateBeforeSubmit()
    if (amountUsd == null) return

    setShowCardFeeConfirm(false)
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
          phone: phone.trim() || undefined,
          // 고객 이메일·결제 페이지는 스태프 UI 언어와 무관하게 기본 영문
          locale: 'en',
          sendEmail,
          sendSms,
          ...(initials?.reservationId?.trim()
            ? { reservationId: initials.reservationId.trim() }
            : {}),
        }),
      })
      const data = await response.json().catch(() => ({} as Record<string, unknown>))
      if (!response.ok) {
        throw new Error(
          (typeof data.error === 'string' && data.error) ||
            (locale === 'ko' ? '청구 실패' : 'Request failed')
        )
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
        customerEmailUpdated: Boolean(data.customerEmailUpdated),
        previousEmail: data.previousEmail ? String(data.previousEmail) : null,
        specialRequests:
          typeof data.specialRequests === 'string' ? data.specialRequests : null,
        smsSent: Boolean(data.smsSent),
        smsError: data.smsError ? String(data.smsError) : null,
        smsToPhone: data.smsToPhone ? String(data.smsToPhone) : null,
      })
      if (data.customerEmailUpdated) {
        setCustomerEmailSaved(true)
        onCustomerContactUpdated?.({
          email: String(data.email),
          specialRequests:
            typeof data.specialRequests === 'string' ? data.specialRequests : null,
          previousEmail: data.previousEmail ? String(data.previousEmail) : null,
        })
      }
      if (openWhatsAppAfterCreate) {
        const payUrl = String(data.sitePayUrl || data.hostedInvoiceUrl || '')
        openWhatsAppWithPaymentLink({
          payUrl,
          amountUsd: Number(data.amountUsd),
          description: String(data.description || description),
          recipientName: recipientName.trim() || String(data.recipientName || ''),
        })
      }
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

  const openWhatsAppWithPaymentLink = (params: {
    payUrl: string
    amountUsd: number
    description: string
    recipientName: string
  }) => {
    const e164 = resolveSmsPhone(phone)
    if (!e164 || !params.payUrl) {
      setError(
        locale === 'ko'
          ? 'WhatsApp으로 보내려면 유효한 전화번호가 필요합니다.'
          : 'A valid phone number is required to open WhatsApp.'
      )
      return
    }
    const text = buildQuickPaymentRequestSmsText({
      recipientName: params.recipientName,
      description: params.description,
      amountUsd: params.amountUsd,
      payUrl: params.payUrl,
    })
    const waUrl = buildWhatsAppMeUrl(e164, text)
    if (!waUrl) {
      setError(locale === 'ko' ? 'WhatsApp 링크를 만들 수 없습니다.' : 'Could not build a WhatsApp link.')
      return
    }
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  const sendSmsFromResult = async () => {
    if (!result || smsSending) return
    if (!resolveSmsPhone(phone)) {
      setError(
        locale === 'ko'
          ? '문자로 보내려면 유효한 전화번호를 입력해 주세요.'
          : 'Enter a valid phone number to send SMS.'
      )
      return
    }
    setSmsSending(true)
    setError(null)
    try {
      const response = await fetchApiWithAuth('/api/invoices/quick-payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendSmsOnly: true,
          invoiceId: result.invoiceId,
          phone: phone.trim(),
          recipientName: recipientName.trim() || undefined,
          locale,
        }),
      })
      const data = await response.json().catch(() => ({} as Record<string, unknown>))
      if (!response.ok) {
        throw new Error(
          (typeof data.error === 'string' && data.error) ||
            (locale === 'ko' ? 'SMS 발송 실패' : 'SMS failed')
        )
      }
      setResult((prev) =>
        prev
          ? {
              ...prev,
              smsSent: true,
              smsError: null,
              smsToPhone: data.toPhone ? String(data.toPhone) : prev.smsToPhone,
            }
          : prev
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : locale === 'ko' ? 'SMS 발송 실패' : 'SMS failed'
      setResult((prev) => (prev ? { ...prev, smsSent: false, smsError: message } : prev))
    } finally {
      setSmsSending(false)
    }
  }

  const isOtaTempEmail = isGetYourGuideReplyEmail(email)
  const originalWasOtaTempEmail = isGetYourGuideReplyEmail(initials?.email)
  const canSaveCustomerEmail =
    Boolean(initials?.reservationId?.trim()) &&
    originalWasOtaTempEmail &&
    !isOtaTempEmail &&
    Boolean(email.trim()) &&
    !customerEmailSaved

  const body = (
    <>
      {!isModal && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {locale === 'ko' ? '빠른 금액 청구' : 'Quick Payment Request'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {locale === 'ko'
              ? '금액, 내용, 이메일을 입력하면 Stripe 결제 링크를 만들고 이메일·문자·WhatsApp으로 보낼 수 있습니다.'
              : 'Enter amount, description, and email to create a Stripe payment link and send it by email, SMS, or WhatsApp.'}
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
              {result.customerEmailUpdated && result.previousEmail ? (
                <p className="mt-2 text-sm text-foreground">
                  {locale === 'ko'
                    ? `고객 이메일을 ${result.email}(으)로 업데이트했고, 기존 주소(${result.previousEmail})는 특별 요청에 남겼습니다.`
                    : `Customer email was updated to ${result.email}. The previous address (${result.previousEmail}) was saved in special requests.`}
                </p>
              ) : null}
              {result.smsSent ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700">
                  <Smartphone className="h-4 w-4" aria-hidden />
                  {locale === 'ko'
                    ? `문자(SMS)를 발송했습니다${result.smsToPhone ? ` (${result.smsToPhone})` : ''}.`
                    : `SMS sent${result.smsToPhone ? ` (${result.smsToPhone})` : ''}.`}
                </p>
              ) : result.smsError ? (
                <p className="mt-2 text-sm text-amber-700">{result.smsError}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm break-all">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {locale === 'ko' ? '결제 링크' : 'Payment link'}
            </p>
            {result.sitePayUrl || result.hostedInvoiceUrl}
          </div>

          <div className="space-y-2">
            <label htmlFor="qp-result-phone" className="text-sm font-medium text-foreground">
              {locale === 'ko' ? '전화번호 (문자 / WhatsApp)' : 'Phone (SMS / WhatsApp)'}
            </label>
            <input
              id="qp-result-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="+1 702 555 0100"
            />
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
              disabled={smsSending || !resolveSmsPhone(phone)}
              onClick={() => {
                void sendSmsFromResult()
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-60"
            >
              {smsSending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Smartphone className="h-4 w-4" aria-hidden />
              )}
              {locale === 'ko' ? '문자로 보내기' : 'Send SMS'}
            </button>
            <button
              type="button"
              disabled={!resolveSmsPhone(phone)}
              onClick={() =>
                openWhatsAppWithPaymentLink({
                  payUrl: result.sitePayUrl || result.hostedInvoiceUrl,
                  amountUsd: result.amountUsd,
                  description: result.description,
                  recipientName: recipientName.trim() || result.email,
                })
              }
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-60"
            >
              <WhatsAppGlyph className="h-4 w-4" />
              {locale === 'ko' ? 'WhatsApp으로 보내기' : 'Send WhatsApp'}
            </button>
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
          onSubmit={(e) => {
            handleSubmitClick(e)
          }}
          noValidate
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
              aria-invalid={isOtaTempEmail || undefined}
              className={`h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isOtaTempEmail ? 'border-amber-400' : 'border-input'
              }`}
              placeholder="guest@example.com"
            />
            {isOtaTempEmail ? (
              <div
                className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950"
                role="alert"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                <p>
                  {locale === 'ko'
                    ? '이 주소는 GetYourGuide OTA 임시 메일(@reply.getyourguide.com)이라 고객에게 도달하지 않습니다. 금액 청구를 보내려면 고객의 실제 이메일을 입력하세요. 여기서 바꾸면 고객 이메일도 함께 업데이트되고, 기존 주소는 고객 정보 · 특별 요청에 남습니다.'
                    : 'This is a GetYourGuide OTA relay address (@reply.getyourguide.com), not the guest inbox. Enter the guest\'s real email to send a payment request. Updating it here also updates the customer email, and the old address is kept in customer special requests.'}
                </p>
              </div>
            ) : originalWasOtaTempEmail ? (
              <div className="space-y-2">
                <p className="text-xs leading-5 text-teal-800">
                  {customerEmailSaved
                    ? locale === 'ko'
                      ? '고객 이메일을 업데이트했고, 기존 OTA 주소는 특별 요청에 남겼습니다.'
                      : 'Customer email was updated. The previous OTA address was saved in special requests.'
                    : locale === 'ko'
                      ? '고객의 실제 이메일로 바꿨습니다. 청구하면 고객 이메일이 자동 업데이트되고, 기존 OTA 주소는 특별 요청에 남습니다.'
                      : 'This is the guest\'s real email. Submitting will update the customer record and keep the previous OTA address in special requests.'}
                </p>
                {canSaveCustomerEmail ? (
                  <button
                    type="button"
                    disabled={savingCustomerEmail}
                    onClick={() => {
                      void handleUpdateCustomerEmail()
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-teal-600 px-3 text-xs font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
                  >
                    {savingCustomerEmail ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : null}
                    {locale === 'ko' ? '고객 이메일만 업데이트' : 'Update customer email only'}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                {locale === 'ko'
                  ? initials?.reservationId?.trim()
                    ? `결제 완료 시 예약(${initials.reservationId.trim().slice(0, 8)}…)에 입금·잔금이 자동 반영됩니다.`
                    : '결제 완료 시 이 이메일과 연결된 예약에 입금·잔금이 자동 반영됩니다.'
                  : initials?.reservationId?.trim()
                    ? `When paid, deposit and balance update on reservation ${initials.reservationId.trim().slice(0, 8)}…`
                    : 'When paid, deposit and balance update on the reservation matched by this email.'}
              </p>
            )}
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
            <label htmlFor="qp-phone" className="text-sm font-medium text-foreground">
              {locale === 'ko' ? '전화번호 (문자 / WhatsApp)' : 'Phone (SMS / WhatsApp)'}
            </label>
            <input
              id="qp-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="+1 702 555 0100"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              {locale === 'ko'
                ? '국가번호 포함(+1, +82 등)으로 입력하면 문자·WhatsApp 발송이 더 정확합니다.'
                : 'Include the country code (+1, +82, etc.) so SMS and WhatsApp can be delivered.'}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="qp-amount" className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm font-medium text-foreground">
              <span>{locale === 'ko' ? '금액 (USD)' : 'Amount (USD)'}</span>
              {amount.trim() !== '' ? (
                <span className="text-xs font-medium text-red-600">
                  {locale === 'ko'
                    ? '수수료 포함 금액인지 확인하세요'
                    : 'Confirm this amount includes the fee'}
                </span>
              ) : null}
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
                  { value: '5% Card Fee', labelKo: '5% 카드 수수료', labelEn: '5% Card Fee' },
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
                  ? '예: Non-Resident Fee, Tour Balance, Guide Tips, 5% Card Fee'
                  : 'e.g. Non-Resident Fee, Tour Balance, Guide Tips, 5% Card Fee'
              }
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              {locale === 'ko'
                ? '이메일로 결제 링크 보내기'
                : 'Email the payment link'}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={sendSms}
                onChange={(e) => setSendSms(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              {locale === 'ko' ? '문자(SMS)로 결제 링크 보내기' : 'Send the payment link by SMS'}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={openWhatsAppAfterCreate}
                onChange={(e) => setOpenWhatsAppAfterCreate(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              {locale === 'ko'
                ? 'WhatsApp 창 열기 (링크가 채워진 채 전송)'
                : 'Open WhatsApp with the payment link'}
            </label>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={submitting || isOtaTempEmail || savingCustomerEmail}
            onClick={(e) => {
              handleSubmitClick(e)
            }}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                {locale === 'ko' ? '처리 중…' : 'Processing…'}
              </>
            ) : (
              <>
                {sendEmail || sendSms || openWhatsAppAfterCreate ? (
                  <Send className="h-5 w-5" aria-hidden />
                ) : (
                  <CreditCard className="h-5 w-5" aria-hidden />
                )}
                {sendEmail || sendSms || openWhatsAppAfterCreate
                  ? locale === 'ko'
                    ? '청구하고 보내기'
                    : 'Charge & send'
                  : locale === 'ko'
                    ? '결제 링크만 만들기'
                    : 'Create payment link only'}
              </>
            )}
          </button>
        </form>
      )}

      {showCardFeeConfirm
        ? createPortal(
            <div
              className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 pointer-events-auto"
              style={{ zIndex: confirmZIndex }}
              data-quick-payment-card-fee-confirm
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowCardFeeConfirm(false)
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="qp-card-fee-confirm-title"
            >
              <div
                className="relative w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-lg"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h3
                  id="qp-card-fee-confirm-title"
                  className="text-base font-semibold tracking-tight text-foreground"
                >
                  {locale === 'ko' ? '카드 수수료 확인' : 'Confirm card fee'}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {locale === 'ko'
                    ? '청구 금액에 카드 수수료(5%)가 포함되어 있는지 확인하셨나요? 확인 후 결제 요청을 보냅니다.'
                    : 'Have you confirmed that this amount includes the 5% card fee? The payment request will be sent after you confirm.'}
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCardFeeConfirm(false)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
                  >
                    {locale === 'ko' ? '돌아가기' : 'Go back'}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      void submitPaymentRequest()
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {locale === 'ko' ? '처리 중…' : 'Processing…'}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" aria-hidden />
                        {locale === 'ko' ? '확인 후 보내기' : 'Confirm & send'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
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
  initials?: QuickPaymentFormInitials | undefined
  /** 예약 수정 모달 등 상위 오버레이 위에 띄울 때 */
  overlayZIndex?: number
  onCustomerContactUpdated?: (payload: QuickPaymentCustomerContactUpdate) => void
}

type HistoryItem = {
  id: string
  invoiceNumber: string
  status: string
  total: number
  description: string
  email: string
  recipientName: string
  reservationId: string | null
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
  overlayZIndex,
  onCustomerContactUpdated,
}: QuickPaymentRequestModalProps) {
  const stackedZIndex = useReservationFormChildOverlayZIndex(DIALOG_Z_INDEX.elevated)
  const resolvedOverlayZIndex = overlayZIndex ?? stackedZIndex
  const [view, setView] = useState<'form' | 'history'>('form')
  const [formInitials, setFormInitials] = useState<QuickPaymentFormInitials | undefined>(initials)
  const [formKey, setFormKey] = useState(0)
  const [mounted, setMounted] = useState(false)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 모달이 열릴 때만 폼을 리셋 — 열린 동안 initials 참조 변경으로 전체 리마운트/새로고침처럼 보이는 현상 방지
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setView('form')
      setFormInitials(initials)
      setFormKey((k) => k + 1)
    }
    wasOpenRef.current = open
  }, [open, initials])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[data-quick-payment-card-fee-confirm]')) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: resolvedOverlayZIndex }}
      onClick={(e) => {
        e.preventDefault()
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
        onMouseDown={(e) => e.stopPropagation()}
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
                  ? '이메일, 문자, WhatsApp으로 Stripe 결제 링크를 보낼 수 있습니다.'
                  : 'Send a Stripe payment link by email, SMS, or WhatsApp.'}
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
              if (item.reservationId?.trim()) next.reservationId = item.reservationId.trim()
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
            overlayZIndex={resolvedOverlayZIndex}
            {...(onCustomerContactUpdated ? { onCustomerContactUpdated } : {})}
          />
        )}
      </div>
    </div>,
    document.body
  )
}
