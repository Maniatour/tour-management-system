import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { getAssignmentStatusLabel, normalizeAssignmentStatus } from '@/lib/guideAssignmentStatus'

export type GuideScheduleAssignmentHistoryEventKind =
  | 'guide_assigned'
  | 'guide_unassigned'
  | 'assistant_assigned'
  | 'assistant_unassigned'
  | 'status_changed'
  | 'confirm_request_sent'
  | 'confirm_popup_acknowledged'

export type GuideScheduleAssignmentHistoryEvent = {
  id: string
  kind: GuideScheduleAssignmentHistoryEventKind
  occurredAt: string
  actorEmail?: string | null
  recipientEmail?: string | null
  recipientRole?: 'guide' | 'assistant' | null
  fromValue?: string | null
  toValue?: string | null
  detail?: string | null
}

export type GuideScheduleAssignmentHistorySummary = {
  tourId: string
  tourDate?: string | null
  currentAssignmentStatus?: string | null
  currentGuideId?: string | null
  currentAssistantId?: string | null
}

const ASSIGNMENT_AUDIT_FIELDS = new Set([
  'assignment_status',
  'tour_guide_id',
  'assistant_id',
])

type AuditRow = {
  id: string
  action: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[] | null
  user_email: string | null
  created_at: string
}

type PopupRow = {
  id: string
  recipient_email: string
  recipient_role: string
  sent_by: string | null
  sms_status: string | null
  sms_error: string | null
  acknowledged_at: string | null
  created_at: string
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s || null
}

function auditEventsFromRow(row: AuditRow, locale: string): GuideScheduleAssignmentHistoryEvent[] {
  const events: GuideScheduleAssignmentHistoryEvent[] = []
  const fields = row.changed_fields ?? []

  for (const field of fields) {
    if (!ASSIGNMENT_AUDIT_FIELDS.has(field)) continue

    const oldVal = asString(row.old_values?.[field])
    const newVal = asString(row.new_values?.[field])

    if (field === 'tour_guide_id') {
      if (newVal && newVal !== oldVal) {
        events.push({
          id: `${row.id}-guide-assigned`,
          kind: 'guide_assigned',
          occurredAt: row.created_at,
          actorEmail: row.user_email,
          recipientEmail: newVal,
          recipientRole: 'guide',
          fromValue: oldVal,
          toValue: newVal,
        })
      } else if (oldVal && !newVal) {
        events.push({
          id: `${row.id}-guide-unassigned`,
          kind: 'guide_unassigned',
          occurredAt: row.created_at,
          actorEmail: row.user_email,
          recipientEmail: oldVal,
          recipientRole: 'guide',
          fromValue: oldVal,
          toValue: null,
        })
      }
      continue
    }

    if (field === 'assistant_id') {
      if (newVal && newVal !== oldVal) {
        events.push({
          id: `${row.id}-assistant-assigned`,
          kind: 'assistant_assigned',
          occurredAt: row.created_at,
          actorEmail: row.user_email,
          recipientEmail: newVal,
          recipientRole: 'assistant',
          fromValue: oldVal,
          toValue: newVal,
        })
      } else if (oldVal && !newVal) {
        events.push({
          id: `${row.id}-assistant-unassigned`,
          kind: 'assistant_unassigned',
          occurredAt: row.created_at,
          actorEmail: row.user_email,
          recipientEmail: oldVal,
          recipientRole: 'assistant',
          fromValue: oldVal,
          toValue: null,
        })
      }
      continue
    }

    if (field === 'assignment_status') {
      const fromStatus = normalizeAssignmentStatus(oldVal)
      const toStatus = normalizeAssignmentStatus(newVal)
      if (fromStatus === toStatus) continue
      events.push({
        id: `${row.id}-status`,
        kind: 'status_changed',
        occurredAt: row.created_at,
        actorEmail: row.user_email,
        fromValue: getAssignmentStatusLabel(fromStatus, locale),
        toValue: getAssignmentStatusLabel(toStatus, locale),
        detail: `${fromStatus} → ${toStatus}`,
      })
    }
  }

  return events
}

function popupEventsFromRow(row: PopupRow): GuideScheduleAssignmentHistoryEvent[] {
  const events: GuideScheduleAssignmentHistoryEvent[] = []
  const role = row.recipient_role === 'assistant' ? 'assistant' : 'guide'

  let smsDetail: string | null = null
  if (row.sms_status === 'sent') smsDetail = 'SMS 발송 성공'
  else if (row.sms_status === 'failed') smsDetail = row.sms_error ? `SMS 실패: ${row.sms_error}` : 'SMS 실패'
  else if (row.sms_status === 'skipped') smsDetail = row.sms_error || '사이트 팝업만 발송'

  events.push({
    id: `${row.id}-sent`,
    kind: 'confirm_request_sent',
    occurredAt: row.created_at,
    actorEmail: row.sent_by,
    recipientEmail: row.recipient_email,
    recipientRole: role,
    detail: smsDetail,
  })

  if (row.acknowledged_at) {
    events.push({
      id: `${row.id}-ack`,
      kind: 'confirm_popup_acknowledged',
      occurredAt: row.acknowledged_at,
      recipientEmail: row.recipient_email,
      recipientRole: role,
    })
  }

  return events
}

export async function fetchGuideScheduleAssignmentHistory(
  supabase: SupabaseClient<Database>,
  tourId: string,
  locale = 'ko',
): Promise<{
  summary: GuideScheduleAssignmentHistorySummary
  events: GuideScheduleAssignmentHistoryEvent[]
}> {
  const [tourResult, auditResult, popupResult] = await Promise.all([
    supabase
      .from('tours')
      .select('id, tour_date, assignment_status, tour_guide_id, assistant_id')
      .eq('id', tourId)
      .maybeSingle(),
    supabase
      .from('audit_logs')
      .select('id, action, old_values, new_values, changed_fields, user_email, created_at')
      .eq('table_name', 'tours')
      .eq('record_id', tourId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('guide_schedule_confirm_popups')
      .select(
        'id, recipient_email, recipient_role, sent_by, sms_status, sms_error, acknowledged_at, created_at',
      )
      .eq('tour_id', tourId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const tour = tourResult.data
  const summary: GuideScheduleAssignmentHistorySummary = {
    tourId,
    tourDate: tour?.tour_date ?? null,
    currentAssignmentStatus: tour?.assignment_status ?? null,
    currentGuideId: tour?.tour_guide_id ?? null,
    currentAssistantId: tour?.assistant_id ?? null,
  }

  const auditEvents = (auditResult.data ?? []).flatMap((row) =>
    auditEventsFromRow(row as AuditRow, locale),
  )
  const popupEvents = (popupResult.data ?? []).flatMap((row) =>
    popupEventsFromRow(row as PopupRow),
  )

  const events = [...auditEvents, ...popupEvents].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )

  return { summary, events }
}

export function getGuideScheduleAssignmentHistoryEventLabel(
  kind: GuideScheduleAssignmentHistoryEventKind,
  locale: string,
): string {
  const ko: Record<GuideScheduleAssignmentHistoryEventKind, string> = {
    guide_assigned: '가이드 배정',
    guide_unassigned: '가이드 배정 해제',
    assistant_assigned: '어시스턴트 배정',
    assistant_unassigned: '어시스턴트 배정 해제',
    status_changed: '배정 상태 변경',
    confirm_request_sent: '스케줄 컨펌 요청 발송',
    confirm_popup_acknowledged: '가이드 팝업 확인',
  }
  const en: Record<GuideScheduleAssignmentHistoryEventKind, string> = {
    guide_assigned: 'Guide assigned',
    guide_unassigned: 'Guide unassigned',
    assistant_assigned: 'Assistant assigned',
    assistant_unassigned: 'Assistant unassigned',
    status_changed: 'Assignment status changed',
    confirm_request_sent: 'Schedule confirm request sent',
    confirm_popup_acknowledged: 'Guide acknowledged popup',
  }
  const dict = locale === 'en' ? en : ko
  return dict[kind]
}

export function getGuideScheduleAssignmentHistoryEventColor(
  kind: GuideScheduleAssignmentHistoryEventKind,
): string {
  switch (kind) {
    case 'guide_assigned':
    case 'assistant_assigned':
      return 'bg-violet-100 text-violet-800'
    case 'guide_unassigned':
    case 'assistant_unassigned':
      return 'bg-gray-100 text-gray-700'
    case 'status_changed':
      return 'bg-amber-100 text-amber-900'
    case 'confirm_request_sent':
      return 'bg-indigo-100 text-indigo-800'
    case 'confirm_popup_acknowledged':
      return 'bg-emerald-100 text-emerald-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
