'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Check, Copy, Eye, Loader2, MessageSquare, RotateCcw, Send, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { supabase } from '@/lib/supabase'
import type {
  GuideScheduleAssignmentPreview,
  GuideScheduleAssignmentSendChannels,
} from '@/lib/guideScheduleAssignmentMessage'
import { guideScheduleConfirmLocaleLabel } from '@/lib/guideScheduleConfirmMessage'

type GuideScheduleAssignmentPreviewModalProps = {
  isOpen: boolean
  tourId: string | null
  locale: string
  onClose: () => void
  onSent?: () => void
}

type PushEdit = { title: string; body: string }

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

function sendButtonLabel(channels: GuideScheduleAssignmentSendChannels, isKo: boolean): string {
  if (channels === 'push') return isKo ? '푸시 발송' : 'Send push'
  if (channels === 'both') return isKo ? 'SMS + 푸시 발송' : 'Send SMS + push'
  return isKo ? 'SMS 발송' : 'Send SMS'
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
  const [pushEdits, setPushEdits] = useState<Record<string, PushEdit>>({})
  const [channels, setChannels] = useState<GuideScheduleAssignmentSendChannels>('both')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const needsSms = channels === 'sms' || channels === 'both'
  const needsPush = channels === 'push' || channels === 'both'

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
      const nextSms: Record<string, string> = {}
      const nextPush: Record<string, PushEdit> = {}
      for (const r of nextPreview.recipients) {
        nextSms[r.email] = r.smsBody
        nextPush[r.email] = { title: r.pushTitle, body: r.pushBody }
      }
      setSmsEdits(nextSms)
      setPushEdits(nextPush)
      setSelectedEmails(new Set(nextPreview.recipients.map((r) => r.email)))
      setChannels('both')
    } catch (e) {
      setError(e instanceof Error ? e.message : '미리보기를 불러올 수 없습니다.')
      setPreview(null)
      setSmsEdits({})
      setPushEdits({})
    } finally {
      setLoading(false)
    }
  }, [tourId, locale])

  useEffect(() => {
    if (!isOpen || !tourId) {
      setPreview(null)
      setSmsEdits({})
      setPushEdits({})
      setError(null)
      return
    }
    void loadPreview()
  }, [isOpen, tourId, loadPreview])

  const channelOptions = useMemo(
    () =>
      [
        { value: 'sms' as const, label: isKo ? 'SMS만' : 'SMS only', icon: MessageSquare },
        { value: 'push' as const, label: isKo ? '푸시만' : 'Push only', icon: Bell },
        { value: 'both' as const, label: isKo ? 'SMS + 푸시' : 'SMS + push', icon: Send },
      ] as const,
    [isKo]
  )

  const toggleRecipient = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  const resetRecipientContent = (email: string) => {
    const original = preview?.recipients.find((r) => r.email === email)
    if (!original) return
    setSmsEdits((prev) => ({ ...prev, [email]: original.smsBody }))
    setPushEdits((prev) => ({
      ...prev,
      [email]: { title: original.pushTitle, body: original.pushBody },
    }))
  }

  const handleSend = async () => {
    if (!tourId || selectedEmails.size === 0 || !preview) return

    for (const email of selectedEmails) {
      if (needsSms && !smsEdits[email]?.trim()) {
        setError(isKo ? '선택한 수신자의 SMS 내용을 입력해 주세요.' : 'Fill in SMS content for selected recipients.')
        return
      }
      const push = pushEdits[email]
      if (needsPush && (!push?.title?.trim() || !push?.body?.trim())) {
        setError(isKo ? '선택한 수신자의 푸시 내용을 입력해 주세요.' : 'Fill in push content for selected recipients.')
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
        ...(needsSms ? { smsBody: smsEdits[email]!.trim() } : {}),
        ...(needsPush
          ? {
              pushTitle: pushEdits[email]!.title.trim(),
              pushBody: pushEdits[email]!.body.trim(),
            }
          : {}),
      }))

      const response = await fetchApiWithAuth('/api/guide-schedule-assignment/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tourId,
          locale,
          channels,
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
              {isKo ? '가이드 스케줄 부여' : 'Guide schedule assignment'}
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
                  ? '발송 시 가이드 앱 접속 모달이 항상 등록됩니다. SMS·푸시는 아래에서 선택합니다. 가이드는 모달에서 확정/거절할 수 있습니다.'
                  : 'A guide-app modal is always queued on send. Choose SMS and/or push below. Guides can confirm or reject in the modal.'}
              </p>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">
                  {preview.tourDate} · {preview.productName}
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-gray-700">
                  {isKo ? '발송 채널' : 'Delivery channel'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {channelOptions.map((opt) => {
                    const Icon = opt.icon
                    const active = channels === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setChannels(opt.value)}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                          active
                            ? 'border-violet-500 bg-violet-50 text-violet-800'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
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
                const push = pushEdits[recipient.email] ?? {
                  title: recipient.pushTitle,
                  body: recipient.pushBody,
                }
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
                        onClick={() => resetRecipientContent(recipient.email)}
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

                    <div className="mb-3 rounded-md border border-emerald-100 bg-emerald-50/50 p-2.5">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        {isKo ? '앱 접속 모달 (항상 등록)' : 'In-app modal (always queued)'}
                      </p>
                      <p className="text-sm font-semibold text-gray-900">{recipient.siteTitle}</p>
                      <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-700">
                        {recipient.siteMessageBody}
                      </pre>
                    </div>

                    {needsSms ? (
                      <div className="mb-3">
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
                    ) : null}

                    {needsPush ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            {isKo ? '앱 푸시' : 'App push'}
                          </label>
                          <CopyFieldButton
                            value={`${push.title}\n${push.body}`}
                            fieldKey={`${recipient.email}-push`}
                            copiedField={copiedField}
                            onCopied={handleFieldCopied}
                            isKo={isKo}
                            disabled={!isSelected}
                          />
                        </div>
                        <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-2.5">
                          <p className="mb-1 text-[10px] text-sky-700">
                            {isKo ? '미리보기' : 'Preview'}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">{push.title || '—'}</p>
                          <p className="mt-0.5 text-xs text-gray-700 whitespace-pre-wrap">{push.body || '—'}</p>
                        </div>
                        <input
                          type="text"
                          value={push.title}
                          onChange={(e) =>
                            setPushEdits((prev) => ({
                              ...prev,
                              [recipient.email]: { ...push, title: e.target.value },
                            }))
                          }
                          disabled={!isSelected}
                          placeholder={isKo ? '푸시 제목' : 'Push title'}
                          className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100"
                        />
                        <textarea
                          value={push.body}
                          onChange={(e) =>
                            setPushEdits((prev) => ({
                              ...prev,
                              [recipient.email]: { ...push, body: e.target.value },
                            }))
                          }
                          disabled={!isSelected}
                          rows={2}
                          placeholder={isKo ? '푸시 본문' : 'Push body'}
                          className="w-full resize-y rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100"
                        />
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
            onClick={() => void handleSend()}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sendButtonLabel(channels, isKo)}
          </button>
        </div>
      </div>
    </div>
  )
}
