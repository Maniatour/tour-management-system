'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Eye, Loader2, RotateCcw, Send, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { supabase } from '@/lib/supabase'
import type { GuideScheduleAssignmentPreview } from '@/lib/guideScheduleAssignmentMessage'
import { guideScheduleConfirmLocaleLabel } from '@/lib/guideScheduleConfirmMessage'

type GuideScheduleAssignmentPreviewModalProps = {
  isOpen: boolean
  tourId: string | null
  locale: string
  onClose: () => void
  onSent?: () => void
}

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

export function GuideScheduleAssignmentPreviewModal({
  isOpen,
  tourId,
  locale,
  onClose,
  onSent,
}: GuideScheduleAssignmentPreviewModalProps) {
  const isKo = locale === 'ko'
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<GuideScheduleAssignmentPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [smsEdits, setSmsEdits] = useState<Record<string, string>>({})
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
      const response = await fetchApiWithAuth('/api/guide-schedule-assignment/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId, locale }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || '미리보기를 불러올 수 없습니다.')
      }
      const nextPreview = data as GuideScheduleAssignmentPreview
      setPreview(nextPreview)
      const edits: Record<string, string> = {}
      for (const r of nextPreview.recipients) {
        edits[r.email] = r.smsBody
      }
      setSmsEdits(edits)
      setSelectedEmails(new Set(nextPreview.recipients.map((r) => r.email)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '미리보기를 불러올 수 없습니다.')
      setPreview(null)
      setSmsEdits({})
    } finally {
      setLoading(false)
    }
  }, [tourId, locale])

  useEffect(() => {
    if (!isOpen || !tourId) {
      setPreview(null)
      setSmsEdits({})
      setError(null)
      return
    }
    void loadPreview()
  }, [isOpen, tourId, loadPreview])

  const toggleRecipient = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  const resetRecipientSms = (email: string) => {
    const original = preview?.recipients.find((r) => r.email === email)
    if (!original) return
    setSmsEdits((prev) => ({ ...prev, [email]: original.smsBody }))
  }

  const handleSend = async () => {
    if (!tourId || selectedEmails.size === 0 || !preview) return

    for (const email of selectedEmails) {
      if (!smsEdits[email]?.trim()) {
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
      const recipientOverrides = Array.from(selectedEmails).map((email) => ({
        email,
        smsBody: smsEdits[email]!.trim(),
      }))

      const response = await fetchApiWithAuth('/api/guide-schedule-assignment/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tourId,
          locale,
          sentBy: user?.email || null,
          recipientEmails: Array.from(selectedEmails),
          recipientOverrides,
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
            <Eye className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isKo ? '가이드 스케줄 부여 SMS' : 'Guide schedule assignment SMS'}
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
                  ? '가이드·어시스턴트에게 스케줄 배정 안내 SMS를 보냅니다. 링크를 누르면 확정/거절 화면으로 이동합니다.'
                  : 'Sends schedule assignment SMS with a link to confirm or reject.'}
              </p>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">
                  {preview.tourDate} · {preview.productName}
                </p>
              </div>

              {preview.warnings.length > 0 ? (
                <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {preview.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              ) : null}

              {preview.recipients.map((recipient) => {
                const smsBody = smsEdits[recipient.email] ?? recipient.smsBody
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
                        onClick={() => resetRecipientSms(recipient.email)}
                        className="ml-auto inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
                        title={isKo ? '자동 생성 문구로 되돌리기' : 'Reset to auto-generated text'}
                      >
                        <RotateCcw className="h-3 w-3" />
                        {isKo ? '원문' : 'Reset'}
                      </button>
                    </div>

                    <div className="mb-2 rounded-md border border-violet-100 bg-violet-50/50 px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                        {isKo ? '확정/거절 링크' : 'Confirm/reject link'}
                      </p>
                      <a
                        href={recipient.confirmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-xs text-violet-800 underline"
                      >
                        {recipient.confirmUrl}
                      </a>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          SMS
                        </label>
                        <CopyFieldButton
                          value={smsBody}
                          fieldKey={`${recipient.email}-smsBody`}
                          copiedField={copiedField}
                          onCopied={handleFieldCopied}
                          isKo={isKo}
                          disabled={!isSelected}
                        />
                      </div>
                      <textarea
                        value={smsBody}
                        onChange={(e) =>
                          setSmsEdits((prev) => ({ ...prev, [recipient.email]: e.target.value }))
                        }
                        disabled={!isSelected}
                        rows={5}
                        className="w-full resize-y rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100"
                      />
                    </div>
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
            onClick={() => void handleSend()}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isKo ? 'SMS 발송' : 'Send SMS'}
          </button>
        </div>
      </div>
    </div>
  )
}
