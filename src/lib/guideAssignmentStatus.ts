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
  return n === 'assigned' || n === 'confirmed' || n === 'rejected'
}

export function getAssignmentStatusLabel(
  status: string | null | undefined,
  locale: string = 'ko',
): string {
  const n = normalizeAssignmentStatus(status)
  const ko: Record<string, string> = {
    pending: '대기',
    assigned: '부여',
    confirmed: '확정',
    rejected: '거절',
    cancelled: '취소',
    recruiting: '모집중',
  }
  const en: Record<string, string> = {
    pending: 'Pending',
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
  status: 'confirmed' | 'rejected' | 'assigned' | 'pending',
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
