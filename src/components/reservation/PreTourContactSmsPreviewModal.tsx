'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Eye, Loader2, Send, Pencil, RotateCcw, Check, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PRE_TOUR_CONTACT_SMS_PLACEHOLDER_HINT } from '@/lib/preTourContactSms'
import type { PreTourContactSmsLocale } from '@/lib/preTourContactSmsLocale'
import type { MessengerContactSettings } from '@/lib/preTourContactSms'

type PreviewData = {
  locale: PreTourContactSmsLocale
  message: string
  bodyTemplate: string
  savedInDb: boolean
  toPhone: string | null
  toPhoneDisplay: string
  customerName: string
  contacts: MessengerContactSettings
}

export type PreTourContactSmsPreviewModalProps = {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  customerLanguage: string | null | undefined
  sentBy: string | null
  uiLocale?: 'ko' | 'en'
  onSendSuccess?: () => void
}

const LOCALE_LABELS: Record<PreTourContactSmsLocale, { ko: string; en: string }> = {
  ja: { ko: '일본어', en: 'Japanese' },
  en: { ko: '영어', en: 'English' },
  ko: { ko: '한국어', en: 'Korean' },
}

export default function PreTourContactSmsPreviewModal({
  isOpen,
  onClose,
  reservationId,
  customerLanguage,
  sentBy,
  uiLocale = 'ko',
  onSendSuccess,
}: PreTourContactSmsPreviewModalProps) {
  const isEn = uiLocale === 'en'
  const [smsLocale, setSmsLocale] = useState<PreTourContactSmsLocale>('en')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [bodyTpl, setBodyTpl] = useState('')
  const [contacts, setContacts] = useState<MessengerContactSettings>({
    line_id: '',
    whatsapp: '',
    kakao: '',
    contact_email: '',
  })
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editContacts, setEditContacts] = useState(false)
  const [savedInDb, setSavedInDb] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savingContacts, setSavingContacts] = useState(false)
  const [resettingTemplate, setResettingTemplate] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const inferInitialLocale = useCallback((): PreTourContactSmsLocale => {
    const s = String(customerLanguage ?? '').trim().toLowerCase()
    if (s === 'ja' || s === 'jp' || s === 'jpn' || s.startsWith('ja-')) return 'ja'
    if (s === 'ko' || s === 'kr' || s.startsWith('ko-')) return 'ko'
    return 'en'
  }, [customerLanguage])

  useEffect(() => {
    if (!isOpen) {
      setEditMode(false)
      setEditContacts(false)
      setNotice(null)
      return
    }
    setSmsLocale(inferInitialLocale())
  }, [isOpen, inferInitialLocale])

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const res = await fetch('/api/preview-pre-tour-contact-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          locale: smsLocale,
          bodyTemplate: editMode ? bodyTpl : undefined,
        }),
      })
      const data = (await res.json()) as PreviewData & { error?: string }
      if (!res.ok) {
        setNotice(data.error || (isEn ? 'Failed to load preview.' : '미리보기를 불러오지 못했습니다.'))
        return
      }
      setPreview(data)
      if (!editMode) {
        setBodyTpl(data.bodyTemplate)
        setSavedInDb(data.savedInDb)
      }
      setContacts(data.contacts)
    } catch {
      setNotice(isEn ? 'Failed to load preview.' : '미리보기를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [reservationId, smsLocale, editMode, bodyTpl, isEn])

  useEffect(() => {
    if (!isOpen) return
    void loadPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on locale/reservation open
  }, [isOpen, smsLocale, reservationId])

  useEffect(() => {
    if (!isOpen || !editMode) return
    const t = setTimeout(() => void loadPreview(), 400)
    return () => clearTimeout(t)
  }, [bodyTpl, editMode, isOpen, loadPreview])

  const handleSaveTemplate = async () => {
    setSavingTemplate(true)
    setNotice(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const res = await fetch('/api/pre-tour-contact-sms-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: smsLocale,
          body_template: bodyTpl,
          updated_by: user?.email ?? sentBy,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setNotice(data.error || (isEn ? 'Save failed.' : '템플릿 저장에 실패했습니다.'))
        return
      }
      setSavedInDb(true)
      setNotice(isEn ? 'Template saved.' : '템플릿이 저장되었습니다.')
      await loadPreview()
    } catch {
      setNotice(isEn ? 'Save failed.' : '템플릿 저장에 실패했습니다.')
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleResetTemplate = async () => {
    setResettingTemplate(true)
    setNotice(null)
    try {
      const res = await fetch(
        `/api/pre-tour-contact-sms-template?locale=${smsLocale}`,
        { method: 'DELETE' }
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setNotice(data.error || (isEn ? 'Reset failed.' : '기본값 복원에 실패했습니다.'))
        return
      }
      setEditMode(false)
      setNotice(isEn ? 'Reset to default template.' : '기본 템플릿으로 복원했습니다.')
      await loadPreview()
    } catch {
      setNotice(isEn ? 'Reset failed.' : '기본값 복원에 실패했습니다.')
    } finally {
      setResettingTemplate(false)
    }
  }

  const handleSaveContacts = async () => {
    setSavingContacts(true)
    setNotice(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const res = await fetch('/api/messenger-contact-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contacts,
          updated_by: user?.email ?? sentBy,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setNotice(data.error || (isEn ? 'Contact save failed.' : '연락처 저장에 실패했습니다.'))
        return
      }
      setEditContacts(false)
      setNotice(isEn ? 'Contact info saved.' : '연락처가 저장되었습니다.')
      await loadPreview()
    } catch {
      setNotice(isEn ? 'Contact save failed.' : '연락처 저장에 실패했습니다.')
    } finally {
      setSavingContacts(false)
    }
  }

  const handleSend = async () => {
    if (!preview?.toPhone) {
      alert(isEn ? 'The customer has no valid phone number.' : '유효한 고객 전화번호가 없습니다.')
      return
    }
    if (
      !confirm(
        isEn
          ? `Send SMS to ${preview.toPhoneDisplay || preview.toPhone}?`
          : `${preview.toPhoneDisplay || preview.toPhone}(으)로 SMS를 발송할까요?`
      )
    ) {
      return
    }

    setSending(true)
    setNotice(null)
    try {
      const res = await fetch('/api/send-pre-tour-contact-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          locale: smsLocale,
          bodyTemplate: editMode ? bodyTpl : undefined,
          sentBy,
        }),
      })
      const data = (await res.json()) as { error?: string; details?: string }
      if (!res.ok) {
        setNotice(
          data.details || data.error || (isEn ? 'Send failed.' : 'SMS 발송에 실패했습니다.')
        )
        return
      }
      alert(isEn ? 'SMS sent successfully.' : 'SMS가 발송되었습니다.')
      onSendSuccess?.()
      onClose()
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
      className="fixed inset-0 z-[145] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 shrink-0 text-violet-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {isEn ? 'Pre-tour contact SMS' : '투어 사전 연락 SMS'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X size={22} />
          </button>
        </div>

        <div className="border-b border-gray-100 bg-slate-50 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-600">
              {isEn ? 'Message language' : '문자 언어'}
            </span>
            {(['ja', 'en', 'ko'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  setEditMode(false)
                  setSmsLocale(loc)
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  smsLocale === loc
                    ? 'bg-violet-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {LOCALE_LABELS[loc][uiLocale]}
              </button>
            ))}
          </div>
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
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editMode ? (isEn ? 'Done editing' : '편집 완료') : isEn ? 'Edit template' : '템플릿 편집'}
          </button>
          <button
            type="button"
            onClick={() => setEditContacts((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            <Eye className="h-3.5 w-3.5" />
            {editContacts
              ? isEn
                ? 'Done contacts'
                : '연락처 완료'
              : isEn
                ? 'Edit contacts'
                : '연락처 편집'}
          </button>
          {editMode && (
            <>
              <button
                type="button"
                onClick={() => void handleSaveTemplate()}
                disabled={savingTemplate || !bodyTpl.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
              >
                {savingTemplate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {isEn ? 'Save template' : '템플릿 저장'}
              </button>
              <button
                type="button"
                onClick={() => void handleResetTemplate()}
                disabled={resettingTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                {resettingTemplate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                {isEn ? 'Reset template' : '기본 템플릿'}
              </button>
            </>
          )}
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              savedInDb ? 'bg-violet-100 text-violet-800' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {savedInDb
              ? isEn
                ? 'Saved template'
                : '저장된 템플릿'
              : isEn
                ? 'Default template'
                : '기본 템플릿'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {notice && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {notice}
            </div>
          )}

          <div className="mb-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <div>
              <span className="font-medium">{isEn ? 'To' : '수신'}: </span>
              {preview?.toPhoneDisplay || preview?.toPhone || (isEn ? '—' : '—')}
            </div>
            <div>
              <span className="font-medium">{isEn ? 'Customer' : '고객'}: </span>
              {preview?.customerName || '—'}
            </div>
          </div>

          {editContacts && (
            <div className="mb-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-700">
                {isEn ? 'Messenger contact info (used in template)' : '메신저 연락처 (템플릿에 삽입)'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs">
                  LINE ID
                  <input
                    value={contacts.line_id}
                    onChange={(e) => setContacts((c) => ({ ...c, line_id: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs">
                  WhatsApp
                  <input
                    value={contacts.whatsapp}
                    onChange={(e) => setContacts((c) => ({ ...c, whatsapp: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs">
                  Kakao
                  <input
                    value={contacts.kakao}
                    onChange={(e) => setContacts((c) => ({ ...c, kakao: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs">
                  Email
                  <input
                    value={contacts.contact_email}
                    onChange={(e) => setContacts((c) => ({ ...c, contact_email: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveContacts()}
                disabled={savingContacts}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {savingContacts ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {isEn ? 'Save contacts' : '연락처 저장'}
              </button>
            </div>
          )}

          {editMode && (
            <div className="mb-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-600">{PRE_TOUR_CONTACT_SMS_PLACEHOLDER_HINT}</p>
              <textarea
                value={bodyTpl}
                onChange={(e) => setBodyTpl(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-violet-500"
              />
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">
              {isEn ? 'Preview' : '미리보기'}
            </p>
            {loading ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-gray-200 bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900">
                {preview?.message || (isEn ? 'No preview.' : '미리보기 없음')}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
