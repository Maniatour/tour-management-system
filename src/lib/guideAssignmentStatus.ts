import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

export type GuideAssignmentStatusValue =
  | 'pending'
  | 'assigned'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'recruiting'

export function normalizeAssignmentStatus(status: string | null | undefined): string {
  if (!status) return 'pending'
  const s = status.toLowerCase().trim()
  if (s === 'confirm') return 'confirmed'
  return s
}

export function shouldShowAssignmentStatusIcon(status: string | null | undefined): boolean {
  const n = normalizeAssignmentStatus(status)
  return n === 'pending' || n === 'assigned' || n === 'confirmed' || n === 'rejected'
}

type TourAssignmentStatusSource = {
  assignment_status?: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
}

/** 스케줄뷰·투어 카드에 표시할 배정 상태 (DB assignment_status 기준) */
export function resolveTourDisplayAssignmentStatus(
  tour: TourAssignmentStatusSource | null | undefined,
): string {
  if (!tour) return 'pending'
  return normalizeAssignmentStatus(tour.assignment_status)
}

export function shouldShowTourAssignmentStatusIcon(
  tour: TourAssignmentStatusSource | null | undefined,
): boolean {
  return shouldShowAssignmentStatusIcon(resolveTourDisplayAssignmentStatus(tour))
}

export function getTourAssignmentStatusTooltipLine(
  tour: TourAssignmentStatusSource | null | undefined,
  locale: string = 'ko',
): string {
  const label = getAssignmentStatusLabel(resolveTourDisplayAssignmentStatus(tour), locale)
  return locale === 'en' ? `Assignment status: ${label}` : `배정 상태: ${label}`
}

export function getAssignmentStatusTooltipColorClass(
  tour: TourAssignmentStatusSource | null | undefined,
): string {
  const normalized = resolveTourDisplayAssignmentStatus(tour)
  switch (normalized) {
    case 'pending':
      return 'text-slate-400'
    case 'assigned':
      return 'text-yellow-400'
    case 'confirmed':
      return 'text-green-400'
    case 'rejected':
      return 'text-red-400'
    default:
      return 'text-gray-300'
  }
}

export function getAssignmentStatusLabel(
  status: string | null | undefined,
  locale: string = 'ko',
): string {
  const n = normalizeAssignmentStatus(status)
  const ko: Record<string, string> = {
    pending: '배정 대기',
    assigned: '부여',
    confirmed: '배정',
    rejected: '거절',
    cancelled: '취소',
    recruiting: '모집중',
  }
  const en: Record<string, string> = {
    pending: 'Assignment pending',
    assigned: 'Assigned',
    confirmed: 'Confirmed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    recruiting: 'Recruiting',
  }
  const dict = locale === 'en' ? en : ko
  return dict[n] ?? (locale === 'en' ? 'Unknown' : '미정')
}

export function getAssignmentStatusBadgeColor(status: string | null | undefined): string {
  const n = normalizeAssignmentStatus(status)
  switch (n) {
    case 'assigned':
      return 'bg-violet-100 text-violet-800'
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-800'
    case 'rejected':
      return 'bg-red-100 text-red-800'
    case 'pending':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

type RespondToTourAssignmentResult =
  | {
      ok: true
      assignment_status: string
      personal_responded: boolean
      already_final?: boolean
    }
  | { ok: false; error: string }

/** 가이드 RLS로 tours 직접 UPDATE 불가 → RPC로 확정/거절 + 본인 팝업 ack */
export async function respondToTourAssignment(
  tourId: string,
  decision: 'confirmed' | 'rejected',
  recipientEmail?: string | null,
): Promise<RespondToTourAssignmentResult> {
  // 신규 DB types 에 RPC 반영 전 — any 캐스트
  const { data, error } = await (supabase as any).rpc('respond_to_tour_assignment', {
    p_tour_id: tourId,
    p_decision: decision,
    p_recipient_email: recipientEmail?.trim() ? recipientEmail.trim().toLowerCase() : null,
  })

  if (error) {
    console.error('respondToTourAssignment', error)
    return { ok: false, error: String(error.message || error) }
  }

  const row = (data ?? null) as {
    ok?: boolean
    error?: string
    assignment_status?: string
    personal_responded?: boolean
    already_final?: boolean
  } | null

  if (!row || row.ok !== true) {
    return { ok: false, error: row?.error || 'respond_failed' }
  }

  return {
    ok: true,
    assignment_status: String(row.assignment_status || decision),
    personal_responded: row.personal_responded !== false,
    ...(row.already_final ? { already_final: true } : {}),
  }
}

export async function updateTourAssignmentStatus(
  tourId: string,
  status: GuideAssignmentStatusValue,
  recipientEmail?: string | null,
): Promise<{ ok: true; assignment_status?: string } | { ok: false; error: string }> {
  if (status === 'confirmed' || status === 'rejected') {
    const result = await respondToTourAssignment(tourId, status, recipientEmail)
    if (!result.ok) return result
    return { ok: true, assignment_status: result.assignment_status }
  }

  const { error } = await supabase
    .from('tours')
    .update({ assignment_status: status } as Database['public']['Tables']['tours']['Update'])
    .eq('id', tourId)

  if (error) {
    console.error('updateTourAssignmentStatus', error)
    return { ok: false, error: error.message }
  }
  return { ok: true, assignment_status: status }
}

export async function confirmTourAssignmentForRecipient(
  tourId: string,
  recipientEmail: string,
  _recipientRole: 'guide' | 'assistant',
): Promise<{ ok: true; assignment_status?: string } | { ok: false; error: string }> {
  return respondToTourAssignment(tourId, 'confirmed', recipientEmail)
}

/** 현재 사용자가 이미 응답(ack)한 투어 id 목록 */
export async function fetchPersonallyRespondedTourIds(
  recipientEmail: string | null | undefined,
): Promise<Set<string>> {
  const email = (recipientEmail || '').trim().toLowerCase()
  if (!email) return new Set()

  const { data, error } = await (supabase as any).rpc('list_personally_responded_tour_ids', {
    p_recipient_email: email,
  })

  if (error) {
    console.error('fetchPersonallyRespondedTourIds', error)
    // RPC 미적용 환경 폴백
    const { data: rows, error: fallbackErr } = await supabase
      .from('guide_schedule_confirm_popups')
      .select('tour_id')
      .ilike('recipient_email', email)
      .not('acknowledged_at', 'is', null)
    if (fallbackErr) {
      console.error('fetchPersonallyRespondedTourIds fallback', fallbackErr)
      return new Set()
    }
    return new Set((rows || []).map((row) => String(row.tour_id)).filter(Boolean))
  }

  const ids = Array.isArray(data) ? data : []
  return new Set(ids.map((id) => String(id)).filter(Boolean))
}
