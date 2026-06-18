import { postgrestIlikeQuoted, postgrestEqQuoted, buildTextColumnSearchParts } from '@/lib/postgrestSearchUtils'

export function buildCashTransactionsSearchOr(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return buildTextColumnSearchParts(['description', 'notes'], trimmed, { idEqMinLen: 12 }).join(',')
}

export function buildPaymentRecordsNoteSearchOr(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const q = postgrestIlikeQuoted(trimmed)
  const parts = [`note.ilike.${q}`, `reservation_id.ilike.${q}`]
  if (trimmed.length >= 8 && !/\s/.test(trimmed)) {
    parts.unshift(`id.eq.${postgrestEqQuoted(trimmed)}`)
  }
  return parts.join(',')
}

export function buildCashCompanyExpenseSearchOr(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return buildTextColumnSearchParts(
    ['description', 'notes', 'paid_for', 'paid_to'],
    trimmed
  ).join(',')
}

export function buildCashReservationExpenseSearchOr(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return buildTextColumnSearchParts(['note', 'paid_for', 'paid_to', 'reservation_id'], trimmed).join(',')
}
