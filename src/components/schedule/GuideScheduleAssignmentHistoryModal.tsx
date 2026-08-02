'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Mail,
  User,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchGuideScheduleAssignmentHistory,
  getGuideScheduleAssignmentHistoryEventColor,
  getGuideScheduleAssignmentHistoryEventLabel,
  type GuideScheduleAssignmentHistoryEvent,
  type GuideScheduleAssignmentHistorySummary,
} from '@/lib/guideScheduleAssignmentHistory'
import {
  getAssignmentStatusBadgeColor,
  getAssignmentStatusLabel,
} from '@/lib/guideAssignmentStatus'

type TeamMemberRef = {
  email: string
  name_ko?: string | null
  nick_name?: string | null
}

type GuideScheduleAssignmentHistoryModalProps = {
  isOpen: boolean
  onClose: () => void
  tourId: string | null
  locale?: string
  teamMembers?: TeamMemberRef[]
  tourLabel?: string | null
}

function formatDateTime(value: string, locale: string): string {
  const d = dayjs(value)
  if (!d.isValid()) return value
  return d.format(locale === 'en' ? 'MMM D, YYYY h:mm A' : 'YYYY-MM-DD HH:mm')
}

function resolveMemberLabel(
  email: string | null | undefined,
  teamMembers: TeamMemberRef[],
): string {
  if (!email) return '—'
  const key = email.toLowerCase()
  const member = teamMembers.find((m) => m.email.toLowerCase() === key)
  if (member) return member.nick_name || member.name_ko || member.email
  return email
}

function HistoryEventCard({
  event,
  locale,
  teamMembers,
}: {
  event: GuideScheduleAssignmentHistoryEvent
  locale: string
  teamMembers: TeamMemberRef[]
}) {
  const isKo = locale === 'ko'
  const label = getGuideScheduleAssignmentHistoryEventLabel(event.kind, locale)
  const colorClass = getGuideScheduleAssignmentHistoryEventColor(event.kind)

  return (
    <div className="relative pl-8">
      <span className="absolute left-[11px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary shadow-sm" />
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${colorClass}`}>
            {label}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatDateTime(event.occurredAt, locale)}
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-foreground">
          {event.actorEmail ? (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{isKo ? '처리자' : 'By'}:</span>
              <span className="font-medium">{resolveMemberLabel(event.actorEmail, teamMembers)}</span>
            </div>
          ) : null}

          {event.recipientEmail ? (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {event.recipientRole === 'assistant'
                  ? isKo
                    ? '어시스턴트'
                    : 'Assistant'
                  : isKo
                    ? '가이드'
                    : 'Guide'}
                :
              </span>
              <span className="font-medium">
                {resolveMemberLabel(event.recipientEmail, teamMembers)}
              </span>
            </div>
          ) : null}

          {event.kind === 'status_changed' && (event.fromValue || event.toValue) ? (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{isKo ? '상태' : 'Status'}: </span>
              <span>{event.fromValue || '—'}</span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span className="font-semibold">{event.toValue || '—'}</span>
            </div>
          ) : null}

          {event.detail ? (
            <p className="text-sm text-muted-foreground">{event.detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function GuideScheduleAssignmentHistoryModal({
  isOpen,
  onClose,
  tourId,
  locale = 'ko',
  teamMembers = [],
  tourLabel,
}: GuideScheduleAssignmentHistoryModalProps) {
  const isKo = locale === 'ko'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<GuideScheduleAssignmentHistorySummary | null>(null)
  const [events, setEvents] = useState<GuideScheduleAssignmentHistoryEvent[]>([])

  const loadHistory = useCallback(async () => {
    if (!tourId) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchGuideScheduleAssignmentHistory(supabase, tourId, locale)
      setSummary(result.summary)
      setEvents(result.events)
    } catch (e) {
      console.error('GuideScheduleAssignmentHistoryModal', e)
      setError(isKo ? '기록을 불러오지 못했습니다.' : 'Failed to load history.')
      setSummary(null)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [tourId, locale, isKo])

  useEffect(() => {
    if (!isOpen || !tourId) return
    void loadHistory()
  }, [isOpen, tourId, loadHistory])

  const currentStatusLabel = useMemo(() => {
    if (!summary?.currentAssignmentStatus) return isKo ? '미정' : 'Unknown'
    return getAssignmentStatusLabel(summary.currentAssignmentStatus, locale)
  }, [summary?.currentAssignmentStatus, locale, isKo])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-xl">
        <div className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {isKo ? '가이드 스케줄 배정 기록' : 'Guide schedule assignment history'}
              </h2>
              {tourLabel ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{tourLabel}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {summary ? (
            <div className="mb-5 grid gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{isKo ? '투어일' : 'Tour date'}:</span>
                <span className="font-medium">{summary.tourDate || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{isKo ? '현재 상태' : 'Current status'}:</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${getAssignmentStatusBadgeColor(summary.currentAssignmentStatus)}`}
                >
                  {currentStatusLabel}
                </span>
              </div>
              <div className="text-sm sm:col-span-2">
                <span className="text-muted-foreground">{isKo ? '가이드' : 'Guide'}: </span>
                <span className="font-medium">
                  {resolveMemberLabel(summary.currentGuideId, teamMembers)}
                </span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-muted-foreground">{isKo ? '어시' : 'Asst'}: </span>
                <span className="font-medium">
                  {resolveMemberLabel(summary.currentAssistantId, teamMembers)}
                </span>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              {isKo
                ? '아직 기록된 배정·컨펌 이력이 없습니다.'
                : 'No assignment or confirmation history yet.'}
            </div>
          ) : (
            <div className="relative space-y-4 border-l-2 border-primary/20 pb-2">
              {events.map((event) => (
                <HistoryEventCard
                  key={event.id}
                  event={event}
                  locale={locale}
                  teamMembers={teamMembers}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl bg-muted text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            {isKo ? '닫기' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
