'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Check, Copy, ExternalLink, FileSignature, Loader2, Mail, MessageCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Customer } from '@/types/reservation'
import { customerLanguageIndicatesKorean } from '@/lib/reservationEmailLocale'
import { resolveSmsPhone } from '@/utils/formatPhoneToE164'
import { buildWaiverShareMessage, type WaiverCardSummary } from '@/lib/waiver/cardSummaryBatch'
import {
  applyProductNameToWaiverSummary,
  invalidateWaiverCardSummary,
  subscribeWaiverCardSummary,
} from '@/lib/waiver/cardSummaryClient'

function boxClass(summary: WaiverCardSummary | null, loaded: boolean) {
  if (!loaded) return 'border-2 border-gray-200 bg-gray-50 text-gray-400'
  if (summary?.overall === 'COMPLETE') return 'border-2 border-green-600 bg-green-50 text-green-700'
  return 'border-2 border-amber-400 bg-amber-50 text-amber-800'
}

export function ReservationCardWaiverButton({
  reservationId,
  customer,
  locale,
  bookingNumber,
  tourDate,
  tourName,
  totalPeople = 0,
}: {
  reservationId: string
  customer: Customer | undefined
  locale: string
  bookingNumber?: string
  tourDate?: string
  tourName?: string
  totalPeople?: number
}) {
  const uiKo = locale !== 'en'
  const messageKo = customerLanguageIndicatesKorean(customer?.language)
  const [summary, setSummary] = useState<WaiverCardSummary | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [emailTo, setEmailTo] = useState('')
  const [busy, setBusy] = useState<'link' | 'email' | null>(null)
  const displaySummary = useMemo(
    () => applyProductNameToWaiverSummary(summary, tourName, totalPeople),
    [summary, tourName, totalPeople]
  )

  useEffect(() => {
    return subscribeWaiverCardSummary(reservationId, (row, isLoaded) => {
      setSummary(row)
      setLoaded(isLoaded)
    })
  }, [reservationId])

  useEffect(() => {
    if (!open) return
    setEmailTo(customer?.email?.trim() || '')
    setShareUrl(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [customer?.email, open])

  const shareMeta = useMemo(
    () => ({
      bookingNumber: bookingNumber || summary?.bookingNumber || reservationId,
      tourDate: tourDate || summary?.tourDate || '',
      tourName: tourName || summary?.tourName || 'Tour',
    }),
    [bookingNumber, reservationId, summary, tourDate, tourName]
  )

  const statusLabel = useMemo(() => {
    if (!loaded) return uiKo ? '면책 동의 불러오는 중' : 'Loading waiver status'
    if (!displaySummary) return uiKo ? '면책 동의 현황' : 'Waiver status'
    const counts = `${displaySummary.completeGuests} / ${displaySummary.guestCount}`
    if (displaySummary.overall === 'COMPLETE') {
      return uiKo ? `면책 동의 완료 ${counts}` : `Waivers complete ${counts}`
    }
    return uiKo ? `면책 동의 미완료 ${counts}` : `Waivers incomplete ${counts}`
  }, [displaySummary, loaded, uiKo])

  const ensureUrl = useCallback(async () => {
    if (shareUrl) return shareUrl
    setBusy('link')
    const res = await fetch('/api/admin/waivers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copy-link', reservationId }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || !data.url) {
      toast.error(data.error || (uiKo ? '링크를 만들지 못했습니다' : 'Could not create link'))
      return null
    }
    setShareUrl(data.url)
    if (data.rotated) {
      toast.message(
        uiKo
          ? '새 서명 링크를 만들었습니다. 이전에 공유한 링크는 더 이상 사용할 수 없습니다.'
          : 'A new signing link was created. Previously shared links no longer work.'
      )
    }
    return data.url as string
  }, [reservationId, shareUrl, uiKo])

  async function copyText(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(ok)
    } catch {
      toast.error(uiKo ? '복사하지 못했습니다' : 'Could not copy')
    }
  }

  async function copyLink() {
    const url = await ensureUrl()
    if (!url) return
    await copyText(url, uiKo ? '링크를 복사했습니다' : 'Link copied')
  }

  async function copyMessage() {
    const url = await ensureUrl()
    if (!url) return
    const text = buildWaiverShareMessage({ isKo: messageKo, url, ...shareMeta })
    await copyText(text, uiKo ? '안내 문구를 복사했습니다' : 'Message copied')
  }

  async function shareWhatsApp() {
    const url = await ensureUrl()
    if (!url) return
    const text = buildWaiverShareMessage({ isKo: messageKo, url, ...shareMeta })
    const phone = resolveSmsPhone(customer?.phone) || resolveSmsPhone(customer?.emergency_contact)
    const digits = phone?.replace(/^\+/, '') ?? ''
    window.open(
      digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  async function sendEmail() {
    const to = emailTo.trim()
    if (!to) {
      toast.error(uiKo ? '이메일을 입력해 주세요' : 'Enter an email address')
      return
    }
    const url = await ensureUrl()
    if (!url) return
    setBusy('email')
    const res = await fetch('/api/admin/waivers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-email',
        reservationId,
        email: to,
        url,
        language: messageKo ? 'ko' : 'en',
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      toast.error(data.error || (uiKo ? '이메일을 보내지 못했습니다' : 'Could not send email'))
      return
    }
    toast.success(uiKo ? '면책 동의 이메일을 보냈습니다' : 'Waiver email sent')
    invalidateWaiverCardSummary(reservationId)
  }

  async function openSigningPage() {
    const url = await ensureUrl()
    if (!url) return
    try {
      const parsed = new URL(url)
      window.open(`${window.location.origin}${parsed.pathname}${parsed.search}`, '_blank', 'noopener,noreferrer')
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <>
      <button
        type="button"
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded leading-none transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 ${boxClass(displaySummary, loaded)}`}
        title={statusLabel}
        aria-label={statusLabel}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {!loaded ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />}
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
              onClick={(e) => {
                e.stopPropagation()
                if (e.target === e.currentTarget) setOpen(false)
              }}
            >
              <div
                className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 p-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {uiKo ? '면책 동의' : 'Waivers'}
                  </h3>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                    onClick={() => setOpen(false)}
                    aria-label={uiKo ? '닫기' : 'Close'}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{shareMeta.bookingNumber}</p>
                    <p className="text-xs text-gray-500">
                      {shareMeta.tourName}
                      {shareMeta.tourDate ? ` · ${shareMeta.tourDate}` : ''}
                    </p>
                  </div>
                  {displaySummary ? (
                    <>
                      <div
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${
                          displaySummary.overall === 'COMPLETE'
                            ? 'bg-green-50 text-green-800'
                            : 'bg-amber-50 text-amber-900'
                        }`}
                      >
                        {displaySummary.overall === 'COMPLETE'
                          ? uiKo
                            ? `작성 완료 ${displaySummary.completeGuests} / ${displaySummary.guestCount}`
                            : `Complete ${displaySummary.completeGuests} / ${displaySummary.guestCount}`
                          : uiKo
                            ? `미작성 ${displaySummary.completeGuests} / ${displaySummary.guestCount}`
                            : `Incomplete ${displaySummary.completeGuests} / ${displaySummary.guestCount}`}
                      </div>
                      {displaySummary.participants.length ? (
                        <ul className="space-y-1.5 text-sm">
                          {displaySummary.participants.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-2">
                              <span className="truncate">{p.name}</span>
                              <span className={p.complete ? 'text-green-700' : 'font-medium text-amber-800'}>
                                {p.complete ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" />
                                    {uiKo ? '작성' : 'Signed'}
                                  </span>
                                ) : uiKo ? (
                                  '미작성'
                                ) : (
                                  'Pending'
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">
                          {uiKo
                            ? '참가자 서명이 아직 없습니다. 아래 링크로 고객에게 보내 주세요.'
                            : 'No participant signatures yet. Share the link below with the guest.'}
                        </p>
                      )}
                      {displaySummary.required.length ? (
                        <p className="text-xs text-gray-500">
                          {displaySummary.required.map((code) => code.replace(/_/g, ' ')).join(' · ')}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {loaded
                        ? uiKo
                          ? '현황을 불러오지 못했습니다. 링크 공유는 가능합니다.'
                          : 'Could not load status. You can still share a link.'
                        : uiKo
                          ? '현황을 불러오는 중…'
                          : 'Loading status…'}
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor={`waiver-email-${reservationId}`} className="text-xs font-medium text-gray-700">
                      {uiKo ? '이메일' : 'Email'}
                    </label>
                    <input
                      id={`waiver-email-${reservationId}`}
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                      onClick={() => void copyLink()}
                      disabled={busy !== null}
                    >
                      <Copy className="h-4 w-4" />
                      {uiKo ? '링크 복사' : 'Copy link'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                      onClick={() => void copyMessage()}
                      disabled={busy !== null}
                    >
                      <Copy className="h-4 w-4" />
                      {uiKo ? '문구 복사' : 'Copy text'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                      onClick={() => void shareWhatsApp()}
                      disabled={busy !== null}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                      onClick={() => void sendEmail()}
                      disabled={busy !== null}
                    >
                      {busy === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      {uiKo ? '이메일 보내기' : 'Send email'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-gray-600 underline-offset-2 hover:underline"
                      onClick={() => void openSigningPage()}
                      disabled={busy !== null}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {uiKo ? '서명 페이지 미리보기' : 'Open signing page'}
                    </button>
                    <Link
                      href={`/${locale === 'en' ? 'en' : 'ko'}/admin/waivers/${reservationId}`}
                      className="inline-flex items-center gap-1 text-gray-600 underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {uiKo ? '면책 관리 페이지' : 'Waiver admin'}
                    </Link>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
