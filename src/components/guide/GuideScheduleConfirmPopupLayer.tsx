'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, Loader2, X } from 'lucide-react'
import {
  detectGuidePreferredLanguage,
  type SupportedLocale,
} from '@/lib/guideLanguageDetection'
import {
  guideScheduleConfirmPopupConfirmLabel,
  guideScheduleConfirmPopupOfficeLine,
  guideScheduleConfirmPopupRejectLabel,
  isGuideScheduleConfirmPopupSchemaMissingError,
} from '@/lib/guideScheduleConfirmMessage'
import {
  confirmTourAssignmentForRecipient,
  updateTourAssignmentStatus,
} from '@/lib/guideAssignmentStatus'
import { useAuth } from '@/contexts/AuthContext'
import { canUseAuthenticatedRest, supabase } from '@/lib/supabase'

type PopupRow = {
  id: string
  title: string
  site_message_body: string
  tour_id: string
  recipient_role: 'guide' | 'assistant'
  first_pickup_time: string | null
  office_arrival_time: string | null
  created_at: string
}

type GuideScheduleConfirmPopupLayerProps = {
  userEmail: string | null | undefined
}

export function GuideScheduleConfirmPopupLayer({ userEmail }: GuideScheduleConfirmPopupLayerProps) {
  const { isInitialized } = useAuth()
  const [queue, setQueue] = useState<PopupRow[]>([])
  const [responding, setResponding] = useState(false)
  const [guideLocale, setGuideLocale] = useState<SupportedLocale>('ko')
  const [schemaUnavailable, setSchemaUnavailable] = useState(false)

  const emailKey = (userEmail || '').toLowerCase()

  useEffect(() => {
    if (!emailKey) {
      setGuideLocale('ko')
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('team')
        .select('languages')
        .ilike('email', userEmail || '')
        .maybeSingle()
      if (cancelled) return
      setGuideLocale(detectGuidePreferredLanguage(data, userEmail || undefined))
    })()
    return () => {
      cancelled = true
    }
  }, [userEmail, emailKey])

  const loadPending = useCallback(async () => {
    if (!emailKey || !isInitialized || !canUseAuthenticatedRest() || schemaUnavailable) {
      if (!emailKey) setQueue([])
      return
    }
    try {
      const { data, error } = await supabase
        .from('guide_schedule_confirm_popups')
        .select('id, title, site_message_body, tour_id, recipient_role, first_pickup_time, office_arrival_time, created_at')
        .ilike('recipient_email', emailKey)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: true })
        .limit(5)

      if (error) {
        if (isGuideScheduleConfirmPopupSchemaMissingError(error)) {
          setSchemaUnavailable(true)
          setQueue([])
          return
        }
        console.error(
          'GuideScheduleConfirmPopupLayer',
          error.message ?? error.code ?? String(error)
        )
        return
      }
      setQueue((data || []) as PopupRow[])
    } catch (e) {
      console.error('GuideScheduleConfirmPopupLayer', e)
    }
  }, [emailKey, isInitialized, schemaUnavailable])

  useEffect(() => {
    if (!emailKey || !isInitialized || schemaUnavailable) return
    void loadPending()
    const interval = window.setInterval(() => void loadPending(), 60000)
    return () => window.clearInterval(interval)
  }, [emailKey, isInitialized, loadPending, schemaUnavailable])

  const current = queue[0] ?? null

  const handleRespond = async (decision: 'confirmed' | 'rejected') => {
    if (!current) return
    setResponding(true)
    try {
      const { error } = await supabase
        .from('guide_schedule_confirm_popups')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', current.id)

      if (error) throw error

      const role = current.recipient_role === 'assistant' ? 'assistant' : 'guide'
      if (decision === 'confirmed') {
        const confirmResult = await confirmTourAssignmentForRecipient(
          current.tour_id,
          emailKey,
          role,
        )
        if (!confirmResult.ok) {
          console.warn('GuideScheduleConfirmPopupLayer assignment confirm', confirmResult.error)
        }
      } else {
        const rejectResult = await updateTourAssignmentStatus(current.tour_id, 'rejected')
        if (!rejectResult.ok) {
          console.warn('GuideScheduleConfirmPopupLayer assignment reject', rejectResult.error)
        }
      }

      setQueue((prev) => prev.filter((p) => p.id !== current.id))
    } catch (e) {
      console.error('GuideScheduleConfirmPopupLayer respond', e)
      alert(
        guideLocale === 'ko'
          ? '처리에 실패했습니다.'
          : guideLocale === 'ja'
            ? '処理に失敗しました。'
            : guideLocale === 'zh'
              ? '处理失败。'
              : 'Failed to process.'
      )
    } finally {
      setResponding(false)
    }
  }

  if (!emailKey || !current) return null

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">{current.title}</h2>
        </div>
        <div className="space-y-3 px-5 py-4">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {current.site_message_body}
          </pre>
          {current.office_arrival_time ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
              {guideScheduleConfirmPopupOfficeLine(
                guideLocale,
                current.office_arrival_time,
                current.first_pickup_time
              )}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            disabled={responding}
            onClick={() => void handleRespond('rejected')}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {responding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {guideScheduleConfirmPopupRejectLabel(guideLocale)}
          </button>
          <button
            type="button"
            disabled={responding}
            onClick={() => void handleRespond('confirmed')}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {responding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {guideScheduleConfirmPopupConfirmLabel(guideLocale)}
          </button>
        </div>
      </div>
    </div>
  )
}
