'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ExternalLink, Loader2, Megaphone, PenLine } from 'lucide-react'
import { StaffSiteAlertInteractionForm } from '@/components/admin/staff-site-alert/StaffSiteAlertInteractionForm'
import { StaffSiteAlertInteractionResults } from '@/components/admin/staff-site-alert/StaffSiteAlertInteractionResults'
import {
  parseStaffSiteAlertQuestionRows,
  staffSiteAlertAnswersComplete,
  staffSiteAlertHasInteraction,
  staffSiteAlertInteractionErrorMessage,
  validateStaffSiteAlertAnswers,
  type StaffSiteAlertAnswerInput,
  type StaffSiteAlertInteractionResultQuestion,
  type StaffSiteAlertQuestionRow,
} from '@/lib/staffSiteAlertInteraction'
import { supabase } from '@/lib/supabase'
import { useTeamBoardManualOptional } from '@/contexts/TeamBoardManualContext'
import { useAdminAlertInboxOptional, useReportAdminAlert } from '@/contexts/AdminAlertInboxContext'
import { makeAdminAlertDraft } from '@/lib/adminAlertInbox'
import { asAdminAlertPayload, unshiftUniqueAlert } from '@/lib/adminAlertReplay'
import { useAdminAlertReplay } from '@/hooks/useAdminAlertReplay'
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
  const report = useReportAdminAlert()
  const inbox = useAdminAlertInboxOptional()
  const viewLang: SopEditLocale = locale.startsWith('ko') ? 'ko' : 'en'
  const [queue, setQueue] = useState<PendingAlert[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const [padKey, setPadKey] = useState(0)
  const signatureDataUrlRef = useRef('')
  const [schemaUnavailable, setSchemaUnavailable] = useState(false)
  const [questions, setQuestions] = useState<StaffSiteAlertQuestionRow[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [answers, setAnswers] = useState<StaffSiteAlertAnswerInput[]>([])
  const [resultView, setResultView] = useState<StaffSiteAlertInteractionResultQuestion[] | null>(null)
  const isKo = locale.startsWith('ko')

  const emailKey = (userEmail || '').trim().toLowerCase()

  const loadPending = useCallback(async () => {
    if (!emailKey || schemaUnavailable) {
      if (!emailKey) setQueue([])
      return
    }
    try {
      const primary = await supabase
        .from('staff_site_alert_recipients')
        .select(
          'id, alert_id, acknowledged_at, staff_site_alerts(id, title_ko, title_en, body_ko, body_en, linked_hub_article_ids, requires_signature, display_sender_name, sent_as_super, created_at, interaction_kind, interaction_anonymous, interaction_show_results)'
        )
        .ilike('recipient_email', emailKey)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: true })
        .limit(5)

      let rows = primary.data as Array<{ id: string; staff_site_alerts: StaffSiteAlertRow | null }> | null
      let error = primary.error
      if (error && /interaction_kind|interaction_anonymous|interaction_show_results/i.test(error.message ?? '')) {
        const fallback = await supabase
          .from('staff_site_alert_recipients')
          .select(
            'id, alert_id, acknowledged_at, staff_site_alerts(id, title_ko, title_en, body_ko, body_en, linked_hub_article_ids, requires_signature, display_sender_name, sent_as_super, created_at)'
          )
          .ilike('recipient_email', emailKey)
          .is('acknowledged_at', null)
          .order('created_at', { ascending: true })
          .limit(5)
        rows = (fallback.data || []) as unknown as Array<{ id: string; staff_site_alerts: StaffSiteAlertRow | null }>
        error = fallback.error
      }

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
      for (const item of mapped) {
        report(
          makeAdminAlertDraft('staff_site_alert', item.recipient_id, {
            title: staffSiteAlertLocalizedTitle(item, locale),
            body: staffSiteAlertLocalizedBody(item, locale).slice(0, 180),
            createdAt: item.created_at,
            payload: item,
          })
        )
      }
    } catch (e) {
      console.error('StaffSiteAlertPopupLayer', e)
    }
  }, [emailKey, schemaUnavailable, locale, report])

  useAdminAlertReplay('staff_site_alert', (item) => {
    const row = asAdminAlertPayload<PendingAlert>(item.payload)
    if (!row?.recipient_id) return
    setQueue((prev) => unshiftUniqueAlert(prev, row, (entry) => entry.recipient_id === row.recipient_id))
  })

  useEffect(() => {
    if (!emailKey) return
    void loadPending()
    if (schemaUnavailable) return
    const interval = window.setInterval(() => void loadPending(), 60000)
    return () => window.clearInterval(interval)
  }, [emailKey, loadPending, schemaUnavailable])

  const current = queue[0] ?? null
  const needsInteraction = staffSiteAlertHasInteraction(current?.interaction_kind)
  useEffect(() => {
    signatureDataUrlRef.current = ''
    setSignatureEmpty(true)
    setPadKey((k) => k + 1)
    setAnswers([])
    setResultView(null)
  }, [current?.id])

  useEffect(() => {
    const alertId = current?.id
    if (!alertId || !needsInteraction) {
      setQuestions([])
      setQuestionsLoading(false)
      return
    }
    let cancelled = false
    setQuestionsLoading(true)
    void (async () => {
      const { data, error } = await supabase
        .from('staff_site_alert_questions')
        .select(
          'id, alert_id, sort_order, prompt_ko, prompt_en, question_type, required, staff_site_alert_options(id, question_id, sort_order, label_ko, label_en)'
        )
        .eq('alert_id', alertId)
        .order('sort_order', { ascending: true })
      if (cancelled) return
      if (error) {
        console.error('StaffSiteAlertPopupLayer questions', error)
        setQuestions([])
      } else {
        setQuestions(parseStaffSiteAlertQuestionRows(data))
      }
      setQuestionsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [current?.id, needsInteraction])

  const handleSignaturePadChange = useCallback((empty: boolean, dataUrl: string) => {
    signatureDataUrlRef.current = dataUrl
    setSignatureEmpty((prev) => (prev === empty ? prev : empty))
  }, [])

  const dismissCurrent = () => {
    if (!current) return
    inbox?.markRead(`staff_site_alert:${current.recipient_id}`)
    setQueue((prev) => prev.filter((p) => p.recipient_id !== current.recipient_id))
    setResultView(null)
  }

  const handleConfirm = async () => {
    if (!current) return
    if (resultView) {
      dismissCurrent()
      return
    }
    const drawn = signatureDataUrlRef.current.trim()
    if (current.requires_signature && (signatureEmpty || !drawn)) {
      alert(isKo ? '서명을 그려 주세요.' : 'Please draw your signature.')
      return
    }
    if (needsInteraction) {
      const validated = validateStaffSiteAlertAnswers(questions, answers)
      if (!validated.ok) {
        alert(staffSiteAlertInteractionErrorMessage(validated.error, locale))
        return
      }
    }

    setSubmitting(true)
    try {
      if (needsInteraction) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error(isKo ? '로그인 세션이 없습니다.' : 'Your session has expired.')
        const res = await fetch('/api/staff-site-alerts/respond', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientId: current.recipient_id,
            answers,
            signatureDataUrl: current.requires_signature ? drawn : null,
            locale,
          }),
        })
        const json = (await res.json()) as {
          error?: string
          showResults?: boolean
          results?: StaffSiteAlertInteractionResultQuestion[] | null
        }
        if (!res.ok) throw new Error(json.error || 'failed')
        inbox?.markRead(`staff_site_alert:${current.recipient_id}`)
        if (json.showResults && json.results && json.results.length > 0) {
          setResultView(json.results)
          return
        }
        dismissCurrent()
        return
      }

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
      dismissCurrent()
    } catch (e) {
      console.error('StaffSiteAlertPopupLayer ack', e)
      alert(e instanceof Error && e.message && e.message !== 'failed' ? e.message : isKo ? '확인 처리에 실패했습니다.' : 'Failed to confirm.')
    } finally {
      setSubmitting(false)
    }
  }

  const answersReady = !needsInteraction || (questions.length > 0 && staffSiteAlertAnswersComplete(questions, answers))

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

          {needsInteraction && !resultView ? (
            questionsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isKo ? '문항을 불러오는 중…' : 'Loading questions…'}
              </div>
            ) : questions.length === 0 ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                {isKo
                  ? '투표·설문 문항을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'
                  : 'The questions could not be loaded. Please reopen this alert.'}
              </p>
            ) : (
              <StaffSiteAlertInteractionForm
                locale={locale}
                questions={questions}
                answers={answers}
                onChange={setAnswers}
              />
            )
          ) : null}

          {resultView ? (
            <StaffSiteAlertInteractionResults
              locale={locale}
              kind={current.interaction_kind || 'poll'}
              results={resultView}
            />
          ) : null}

          {current.requires_signature && !resultView ? (
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
            disabled={
              submitting ||
              questionsLoading ||
              (!resultView && current.requires_signature && signatureEmpty) ||
              (!resultView && !answersReady)
            }
            onClick={() => void handleConfirm()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {resultView
              ? isKo
                ? '닫기'
                : 'Close'
              : current.requires_signature
                ? isKo
                  ? '서명 후 확인'
                  : 'Sign & Confirm'
                : needsInteraction
                  ? isKo
                    ? '응답 후 확인'
                    : 'Submit & Confirm'
                  : isKo
                    ? '확인'
                    : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
