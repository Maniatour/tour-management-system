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

export async function updateTourAssignmentStatus(
  tourId: string,
  status: GuideAssignmentStatusValue,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('tours')
    .update({ assignment_status: status } as Database['public']['Tables']['tours']['Update'])
    .eq('id', tourId)

  if (error) {
    console.error('updateTourAssignmentStatus', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function confirmTourAssignmentForRecipient(
  tourId: string,
  recipientEmail: string,
  recipientRole: 'guide' | 'assistant',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: tour, error: fetchErr } = await supabase
    .from('tours')
    .select('tour_guide_id, assistant_id, assignment_status')
    .eq('id', tourId)
    .maybeSingle()

  if (fetchErr || !tour) {
    return { ok: false, error: fetchErr?.message || 'Tour not found' }
  }

  const email = recipientEmail.toLowerCase()
  const isGuide = recipientRole === 'guide' && String(tour.tour_guide_id || '').toLowerCase() === email
  const isAssistant =
    recipientRole === 'assistant' && String(tour.assistant_id || '').toLowerCase() === email

  if (!isGuide && !isAssistant) {
    return { ok: false, error: 'Not assigned to this tour' }
  }

  const current = normalizeAssignmentStatus(tour.assignment_status)
  if (current === 'confirmed' || current === 'rejected') {
    return { ok: true }
  }

  return updateTourAssignmentStatus(tourId, 'confirmed')
}
