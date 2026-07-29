'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Eye, Loader2, RotateCcw, Send, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { supabase } from '@/lib/supabase'
import type { GuideScheduleConfirmPreview } from '@/lib/guideScheduleConfirmMessage'
import { guideScheduleConfirmLocaleLabel } from '@/lib/guideScheduleConfirmMessage'

export type GuideScheduleConfirmRecipientEdits = {
  smsBody: string
  siteTitle: string
  siteMessageBody: string
}

type GuideScheduleConfirmPreviewModalProps = {
  isOpen: boolean
  tourId: string | null
  locale: string
  cachedPreview?: GuideScheduleConfirmPreview | null
  onClose: () => void
  onSent?: () => void
}

type SendMode = 'sms_and_site' | 'site_only'

function CopyFieldButton({
  value,
  fieldKey,
  copiedField,
  onCopied,
  isKo,
  disabled,
}: {
  value: string
  fieldKey: string
  copiedField: string | null
  onCopied: (key: string) => void
  isKo: boolean
  disabled?: boolean
}) {
  const copied = copiedField === fieldKey

  const handleCopy = async () => {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value)
      onCopied(fieldKey)
    } catch {
      alert(isKo ? '복사에 실패했습니다.' : 'Failed to copy.')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={disabled || !value.trim()}
      className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      title={isKo ? '전체 내용 복사' : 'Copy all'}
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? (isKo ? '복사됨' : 'Copied') : isKo ? '복사' : 'Copy'}
    </button>
  )
}

function buildEditsFromPreview(preview: GuideScheduleConfirmPreview): Record<string, GuideScheduleConfirmRecipientEdits> {
  const next: Record<string, GuideScheduleConfirmRecipientEdits> = {}
  for (const r of preview.recipients) {
    next[r.email] = {
      smsBody: r.smsBody,
      siteTitle: r.siteTitle,
      siteMessageBody: r.siteMessageBody,
    }
  }
  return next
}

export function GuideScheduleConfirmPreviewModal({
  isOpen,
  tourId,
  locale,
  cachedPreview = null,
  onClose,
  onSent,
}: GuideScheduleConfirmPreviewModalProps) {
  const isKo = locale === 'ko'
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<GuideScheduleConfirmPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [edits, setEdits] = useState<Record<string, GuideScheduleConfirmRecipientEdits>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleFieldCopied = useCallback((fieldKey: string) => {
    setCopiedField(fieldKey)
    window.setTimeout(() => setCopiedField(null), 2000)
  }, [])

  const loadPreview = useCallback(async () => {
    if (!tourId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetchApiWithAuth('/api/guide-schedule-confirm/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId, locale }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || '미리보기를 불러올 수 없습니다.')
      }
      const nextPreview = data as GuideScheduleConfirmPreview
      setPreview(nextPreview)
      setEdits(buildEditsFromPreview(nextPreview))
      setSelectedEmails(new Set(nextPreview.recipients.map((r) => r.email)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '미리보기를 불러올 수 없습니다.')
      setPreview(null)
      setEdits({})
    } finally {
      setLoading(false)
    }
  }, [tourId, locale])

  useEffect(() => {
    if (!isOpen || !tourId) {
      setPreview(null)
      setEdits({})
      setError(null)
      return
    }
    if (cachedPreview?.tourId === tourId) {
      setPreview(cachedPreview)
      setEdits(buildEditsFromPreview(cachedPreview))
      setSelectedEmails(new Set(cachedPreview.recipients.map((r) => r.email)))
      setLoading(false)
      setError(null)
      return
    }
    void loadPreview()
  }, [isOpen, tourId, cachedPreview, loadPreview])

  const toggleRecipient = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  const updateEdit = (
    email: string,
    field: keyof GuideScheduleConfirmRecipientEdits,
    value: string
  ) => {
    setEdits((prev) => ({
      ...prev,
      [email]: {
        smsBody: prev[email]?.smsBody ?? '',
        siteTitle: prev[email]?.siteTitle ?? '',
        siteMessageBody: prev[email]?.siteMessageBody ?? '',
        [field]: value,
      },
    }))
  }

  const resetRecipientEdits = (email: string) => {
    const original = preview?.recipients.find((r) => r.email === email)
    if (!original) return
    setEdits((prev) => ({
      ...prev,
      [email]: {
        smsBody: original.smsBody,
        siteTitle: original.siteTitle,
        siteMessageBody: original.siteMessageBody,
      },
    }))
  }

  const handleSend = async (sendMode: SendMode) => {
    if (!tourId || selectedEmails.size === 0 || !preview) return

    for (const email of selectedEmails) {
      const content = edits[email]
      if (!content?.siteMessageBody.trim() || !content.siteTitle.trim()) {
        setError(isKo ? '선택한 수신자의 사이트 팝업 내용을 모두 입력해 주세요.' : 'Fill in site popup fields for selected recipients.')
        return
      }
      if (sendMode === 'sms_and_site' && !content.smsBody.trim()) {
        setError(isKo ? '선택한 수신자의 SMS 내용을 입력해 주세요.' : 'Fill in SMS content for selected recipients.')
        return
      }
    }

    setSending(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const recipientOverrides = Array.from(selectedEmails).map((email) => {
        const content = edits[email]!
        return {
          email,
          smsBody: content.smsBody.trim(),
          siteTitle: content.siteTitle.trim(),
          siteMessageBody: content.siteMessageBody.trim(),
        }
      })

      const response = await fetchApiWithAuth('/api/guide-schedule-confirm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tourId,
          locale,
          sentBy: user?.email || null,
          recipientEmails: Array.from(selectedEmails),
          recipientOverrides,
          sendMode,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || '발송에 실패했습니다.')
      }
      alert(data.message || (isKo ? '발송되었습니다.' : 'Sent.'))
      onSent?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '발송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isKo ? '가이드 스케줄 컨펌 미리보기' : 'Guide schedule confirm preview'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              {isKo ? '미리보기 생성 중…' : 'Loading preview…'}
            </div>
          ) : error && !preview ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : preview ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                {isKo
                  ? '발송 전 SMS·사이트 팝업 내용을 직접 수정할 수 있습니다.'
                  : 'You can edit SMS and site popup content before sending.'}
              </p>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">
                  {preview.tourDate} · {preview.productName}
                </p>
                {preview.firstPickupTime ? (
                  <p className="mt-1 text-gray-600">
                    {isKo ? '첫 픽업' : 'First pickup'}: {preview.firstPickupTime}
                    {preview.firstPickupHotelLabel ? ` · ${preview.firstPickupHotelLabel}` : ''}
                  </p>
                ) : null}
                {preview.officeArrivalTime ? (
                  <p className="mt-1 font-medium text-amber-800">
                    {isKo ? '사무실 도착' : 'Arrive at office'}: {preview.officeArrivalTime}
                    {isKo ? ' (첫 픽업 30분 전)' : ' (30 min before first pickup)'}
                  </p>
                ) : null}
              </div>

              {preview.warnings.length > 0 ? (
                <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {preview.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              ) : null}

              {preview.recipients.map((recipient) => {
                const content = edits[recipient.email]
                const isSelected = selectedEmails.has(recipient.email)

                return (
                  <div
                    key={recipient.email}
                    className={`rounded-lg border p-3 ${isSelected ? 'border-gray-200' : 'border-gray-100 opacity-70'}`}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRecipient(recipient.email)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {recipient.displayName}
                          <span className="ml-1 text-xs font-normal text-gray-500">
                            ({recipient.role === 'guide' ? (isKo ? '가이드' : 'Guide') : isKo ? '어시스턴트' : 'Assistant'}
                            · {guideScheduleConfirmLocaleLabel(recipient.locale)})
                          </span>
                        </span>
                      </label>
                      {recipient.phone ? (
                        <span className="text-xs text-gray-500">{recipient.phone}</span>
                      ) : (
                        <span className="text-xs text-red-500">{isKo ? '전화번호 없음' : 'No phone'}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => resetRecipientEdits(recipient.email)}
                        className="ml-auto inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
                        title={isKo ? '자동 생성 문구로 되돌리기' : 'Reset to auto-generated text'}
                      >
                        <RotateCcw className="h-3 w-3" />
                        {isKo ? '원문' : 'Reset'}
                      </button>
                    </div>

                    {content ? (
                      <div className="space-y-2">
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              SMS
                            </label>
                            <CopyFieldButton
                              value={content.smsBody}
                              fieldKey={`${recipient.email}-smsBody`}
                              copiedField={copiedField}
                              onCopied={handleFieldCopied}
                              isKo={isKo}
                              disabled={!isSelected}
                            />
                          </div>
                          <textarea
                            value={content.smsBody}
                            onChange={(e) => updateEdit(recipient.email, 'smsBody', e.target.value)}
                            disabled={!isSelected}
                            rows={4}
                            className="w-full resize-y rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100"
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              {isKo ? '사이트 팝업 제목' : 'Site popup title'}
                            </label>
                            <CopyFieldButton
                              value={content.siteTitle}
                              fieldKey={`${recipient.email}-siteTitle`}
                              copiedField={copiedField}
                              onCopied={handleFieldCopied}
                              isKo={isKo}
                              disabled={!isSelected}
                            />
                          </div>
                          <input
                            type="text"
                            value={content.siteTitle}
                            onChange={(e) => updateEdit(recipient.email, 'siteTitle', e.target.value)}
                            disabled={!isSelected}
                            className="w-full rounded-md border border-gray-200 bg-sky-50/50 px-2 py-1.5 text-xs text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100"
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              {isKo ? '사이트 팝업 본문' : 'Site popup body'}
                            </label>
                            <CopyFieldButton
                              value={content.siteMessageBody}
                              fieldKey={`${recipient.email}-siteMessageBody`}
                              copiedField={copiedField}
                              onCopied={handleFieldCopied}
                              isKo={isKo}
                              disabled={!isSelected}
                            />
                          </div>
                          <textarea
                            value={content.siteMessageBody}
                            onChange={(e) => updateEdit(recipient.email, 'siteMessageBody', e.target.value)}
                            disabled={!isSelected}
                            rows={6}
                            className="w-full resize-y rounded-md border border-gray-200 bg-sky-50 p-2 text-xs text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {error && preview ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {isKo ? '닫기' : 'Close'}
          </button>
          <button
            type="button"
            disabled={sending || loading || !preview || selectedEmails.size === 0}
            onClick={() => void handleSend('site_only')}
            className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isKo ? '사이트 팝업만 발송' : 'Send site popup only'}
          </button>
          <button
            type="button"
            disabled={sending || loading || !preview || selectedEmails.size === 0}
            onClick={() => void handleSend('sms_and_site')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isKo ? '문자 + 사이트 팝업 발송' : 'Send SMS + site popup'}
          </button>
        </div>
      </div>
    </div>
  )
}
