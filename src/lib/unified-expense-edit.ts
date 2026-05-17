import { supabase } from '@/lib/supabase'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import type { UnifiedExpenseSourceTable } from '@/lib/expense-unified-duplicate-scan'
import type { UnifiedLedgerDuplicateExpenseRow } from '@/lib/expense-unified-duplicate-scan'

export type UnifiedExpenseEditDraft = {
  amount: string
  submitDate: string
  paid_to: string
  paid_for: string
  category: string
  company: string
  note: string
  payment_method: string
}

function isoToYmd(iso: string | null | undefined): string {
  if (!iso) return ''
  const s = String(iso).trim()
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function ymdLocalStartToIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toISOString()
}

export function unifiedLedgerRowToEditDraft(row: UnifiedLedgerDuplicateExpenseRow): UnifiedExpenseEditDraft {
  const isTicket = row.source_table === 'ticket_bookings'
  return {
    amount: row.amount != null && Number.isFinite(row.amount) ? String(row.amount) : '',
    submitDate: isoToYmd(row.submit_on),
    paid_to: isTicket ? '' : (row.paid_to ?? '').trim(),
    paid_for: isTicket ? '' : (row.paid_for ?? '').trim(),
    category: isTicket ? (row.paid_for ?? '').trim() : (row.category ?? '').trim(),
    company: isTicket ? (row.paid_to ?? '').trim() : '',
    note: (row.description ?? '').trim(),
    payment_method: (row.payment_method ?? '').trim()
  }
}

export async function saveUnifiedExpenseEdit(
  source: UnifiedExpenseSourceTable,
  id: string,
  draft: UnifiedExpenseEditDraft
): Promise<void> {
  const amt = parseFloat(String(draft.amount).replace(/,/g, ''))
  if (!Number.isFinite(amt) || amt === 0) {
    throw new Error('금액을 확인하세요.')
  }
  if (!draft.submitDate || !/^\d{4}-\d{2}-\d{2}$/.test(draft.submitDate)) {
    throw new Error('등록일(날짜)을 선택하세요.')
  }
  const submitIso = ymdLocalStartToIso(draft.submitDate)
  const pm = draft.payment_method.trim() || null

  if (source === 'tour_expenses') {
    const { error } = await supabase
      .from('tour_expenses')
      .update({
        paid_for: draft.paid_for.trim(),
        paid_to: draft.paid_to.trim() || null,
        amount: amt,
        submit_on: submitIso,
        note: draft.note.trim() || null,
        payment_method: pm,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    if (error) throw error
    return
  }

  if (source === 'reservation_expenses') {
    const res = await fetch(`/api/reservation-expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid_for: draft.paid_for.trim(),
        paid_to: draft.paid_to.trim() || null,
        amount: amt,
        submit_on: submitIso,
        note: draft.note.trim() || null,
        payment_method: pm
      })
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || '예약 지출 수정 실패')
    }
    return
  }

  if (source === 'company_expenses') {
    const res = await fetch('/api/company-expenses', {
      method: 'PUT',
      headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        paid_for: draft.paid_for.trim(),
        category: draft.category.trim(),
        paid_to: draft.paid_to.trim() || null,
        amount: amt,
        submit_on: submitIso,
        notes: draft.note.trim() || null,
        payment_method: pm
      })
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error || '회사 지출 수정 실패')
    }
    return
  }

  if (source === 'ticket_bookings') {
    const cat = draft.category.trim()
    if (!cat) throw new Error('입장권 카테고리를 입력하세요.')
    const { error } = await supabase
      .from('ticket_bookings')
      .update({
        category: cat,
        company: draft.company.trim() || null,
        expense: amt,
        submit_on: submitIso,
        note: draft.note.trim() || null,
        payment_method: pm,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    if (error) throw error
    return
  }

  throw new Error('지원하지 않는 지출 유형입니다.')
}
