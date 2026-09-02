'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ExternalLink, Loader2, Megaphone, PenLine } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTeamBoardManualOptional } from '@/contexts/TeamBoardManualContext'
import { hubArticleLinkLabel } from '@/lib/hubArticleManualLink'
import WaiverSignaturePad from '@/components/waiver/WaiverSignaturePad'
import {
  isStaffSiteAlertSchemaMissingError,
  staffSiteAlertLocalizedBody,
  staffSiteAlertLocalizedTitle,
  type StaffSiteAlertRow,
} from '@/lib/staffSiteAlert'
import type { SopEditLocale } from '@/types/sopStructure'

type PendingAlert = StaffSiteAlertRow & {
  recipient_id: string
  requires_signature: boolean
}

type StaffSiteAlertPopupLayerProps = {
  userEmail: string | null | undefined
  locale: string
}

export function StaffSiteAlertPopupLayer({ userEmail, locale }: StaffSiteAlertPopupLayerProps) {
  const manualCtx = useTeamBoardManualOptional()
  const viewLang: SopEditLocale = locale.startsWith('ko') ? 'ko' : 'en'
  const [queue, setQueue] = useState<PendingAlert[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const [padKey, setPadKey] = useState(0)
  const signatureDataUrlRef = useRef('')
  const [schemaUnavailable, setSchemaUnavailable] = useState(false)
  const isKo = locale.startsWith('ko')

  const emailKey = (userEmail || '').trim().toLowerCase()

  const loadPending = useCallback(async () => {
    if (!emailKey || schemaUnavailable) {
      if (!emailKey) setQueue([])
      return
    }
    try {
      const { data: rows, error } = await supabase
        .from('staff_site_alert_recipients')
        .select(
          'id, alert_id, acknowledged_at, staff_site_alerts(id, title_ko, title_en, body_ko, body_en, linked_hub_article_ids, requires_signature, display_sender_name, sent_as_super, created_at)'
        )
        .ilike('recipient_email', emailKey)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: true })
        .limit(5)

      if (error) {
        if (isStaffSiteAlertSchemaMissingError(error)) {
          setSchemaUnavailable(true)
          setQueue([])
          return
        }
        console.error('StaffSiteAlertPopupLayer', error)
        return
      }

      const mapped: PendingAlert[] = []
      for (const row of rows || []) {
        const alert = row.staff_site_alerts as StaffSiteAlertRow | null
        if (!alert) continue
        mapped.push({
          ...alert,
          recipient_id: row.id,
          requires_signature: alert.requires_signature,
        })
      }
      setQueue(mapped)
    } catch (e) {
      console.error('StaffSiteAlertPopupLayer', e)
    }
  }, [emailKey, schemaUnavailable])

  useEffect(() => {
    if (!emailKey) return
    void loadPending()
    if (schemaUnavailable) return
    const interval = window.setInterval(() => void loadPending(), 60000)
    return () => window.clearInterval(interval)
  }, [emailKey, loadPending, schemaUnavailable])

  const current = queue[0] ?? null
  useEffect(() => {
    signatureDataUrlRef.current = ''
    setSignatureEmpty(true)
    setPadKey((k) => k + 1)
  }, [current?.id])

  const handleSignaturePadChange = useCallback((empty: boolean, dataUrl: string) => {
    signatureDataUrlRef.current = dataUrl
    setSignatureEmpty((prev) => (prev === empty ? prev : empty))
  }, [])

  const handleConfirm = async () => {
    if (!current) return
    const drawn = signatureDataUrlRef.current.trim()
    if (current.requires_signature && (signatureEmpty || !drawn)) {
      alert(isKo ? '서명을 그려 주세요.' : 'Please draw your signature.')
      return
    }

    setSubmitting(true)
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('staff_site_alert_recipients')
        .update({
          acknowledged_at: now,
          ...(current.requires_signature
            ? { signature_text: drawn, signed_at: now }
            : {}),
        })
        .eq('id', current.recipient_id)

      if (error) throw error
      setQueue((prev) => prev.filter((p) => p.recipient_id !== current.recipient_id))
    } catch (e) {
      console.error('StaffSiteAlertPopupLayer ack', e)
      alert(isKo ? '확인 처리에 실패했습니다.' : 'Failed to confirm.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!emailKey || !current) return null

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b px-5 py-4">
          <Megaphone className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-gray-900">
              {staffSiteAlertLocalizedTitle(current, locale)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isKo ? '발송' : 'From'}: {current.display_sender_name}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {staffSiteAlertLocalizedBody(current, locale)}
          </pre>

          {(current.linked_hub_article_ids?.length ?? 0) > 0 ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
                <BookOpen className="h-3.5 w-3.5" />
                {isKo ? '첨부 문서' : 'Attached documents'}
              </p>
              <div className="space-y-1.5">
                {(current.linked_hub_article_ids ?? []).map((articleId) => {
                  const article = manualCtx?.hubArticles.find((row) => row.id === articleId)
                  const label = article
                    ? hubArticleLinkLabel(article, viewLang)
                    : isKo
                      ? '운영 허브 문서 열기'
                      : 'Open Operations Hub document'
                  return (
                    <button
                      key={articleId}
                      type="button"
                      onClick={() => manualCtx?.openManual(articleId)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-left text-sm text-indigo-950 hover:bg-indigo-50"
                    >
                      <span className="truncate font-medium">{label}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {current.requires_signature ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-900">
                <PenLine className="h-4 w-4" />
                {isKo ? '서명이 필요한 안내입니다' : 'Signature required'}
              </div>
              <WaiverSignaturePad
                key={padKey}
                label={isKo ? '수기 서명' : 'Handwritten signature'}
                hint={
                  isKo
                    ? '손가락, 스타일러스 또는 마우스로 서명하세요.'
                    : 'Draw with finger, stylus, or mouse.'
                }
                clearLabel={isKo ? '지우기' : 'Clear'}
                undoLabel={isKo ? '실행 취소' : 'Undo'}
                onChange={handleSignaturePadChange}
              />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end border-t px-5 py-4">
          <button
            type="button"
            disabled={submitting || (current.requires_signature && signatureEmpty)}
            onClick={() => void handleConfirm()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {current.requires_signature
              ? isKo
                ? '서명 후 확인'
                : 'Sign & Confirm'
              : isKo
                ? '확인'
                : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
