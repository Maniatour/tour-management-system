export type ExpenseTableName =
  | 'reservation_expenses'
  | 'company_expenses'
  | 'tour_expenses'

export type NormalizePreviewStatus = 'registered' | 'alias_suggested' | 'unregistered'

import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay'

export interface PaymentMethodRow {
  id: string
  method: string
  display_name: string | null
  card_holder_name?: string | null
}

export interface NormalizePreviewRow {
  sourceTable: ExpenseTableName
  raw: string
  rowCount: number
  status: NormalizePreviewStatus
  suggestedTargetId: string | null
  matchReason: string
  displayNameForTarget: string | null
}

function shortDisplay(row: PaymentMethodRow): string {
  return formatPaymentMethodDisplay({
    id: row.id,
    method: row.method,
    display_name: row.display_name,
    card_holder_name: row.card_holder_name ?? null,
  })
}

/**
 * 저장된 문자열 raw가 payment_methods에 어떻게 대응되는지 추정 (id / method / 표시명 기준).
 */
export function resolvePaymentMethodTarget(
  raw: string,
  pms: PaymentMethodRow[]
): {
  status: NormalizePreviewStatus
  suggestedTargetId: string | null
  matchReason: string
  displayNameForTarget: string | null
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      status: 'unregistered',
      suggestedTargetId: null,
      matchReason: 'empty',
      displayNameForTarget: null,
    }
  }

  const byId = pms.find((p) => p.id === trimmed)
  if (byId) {
    return {
      status: 'registered',
      suggestedTargetId: byId.id,
      matchReason: 'id_match',
      displayNameForTarget: shortDisplay(byId),
    }
  }

  const lower = trimmed.toLowerCase()
  const byMethod = pms.find((p) => p.method?.toLowerCase() === lower)
  if (byMethod) {
    return {
      status: 'alias_suggested',
      suggestedTargetId: byMethod.id,
      matchReason: 'method_name_eq',
      displayNameForTarget: shortDisplay(byMethod),
    }
  }

  for (const p of pms) {
    const d = (p.display_name || '').trim()
    if (!d) continue
    const short = d.includes(' - ') ? d.split(' - ').pop()!.trim().toLowerCase() : d.toLowerCase()
    if (d.toLowerCase() === lower || short === lower) {
      return {
        status: 'alias_suggested',
        suggestedTargetId: p.id,
        matchReason: 'display_name_eq',
        displayNameForTarget: shortDisplay(p),
      }
    }
  }

  // 구 투어 폼 값 (cash, credit_card 등) — method 필드에 해당 문자열이 들어간 행
  const legacyHints = ['cash', 'credit_card', 'debit_card', 'mobile_payment', 'other', 'card']
  if (legacyHints.includes(lower)) {
    const hint = pms.find(
      (p) =>
        p.method?.toLowerCase().includes(lower) ||
        (p.display_name && p.display_name.toLowerCase().includes(lower))
    )
    if (hint) {
      return {
        status: 'alias_suggested',
        suggestedTargetId: hint.id,
        matchReason: 'legacy_keyword',
        displayNameForTarget: shortDisplay(hint),
      }
    }
  }

  return {
    status: 'unregistered',
    suggestedTargetId: null,
    matchReason: 'no_match',
    displayNameForTarget: null,
  }
}

export function buildNormalizePreview(
  stats: Array<{ source_table: string; payment_method: string; row_count: number }>,
  pms: PaymentMethodRow[]
): NormalizePreviewRow[] {
  const pmRows = pms.map((r) => ({
    id: r.id,
    method: r.method,
    display_name: r.display_name,
    card_holder_name: r.card_holder_name ?? null,
  }))

  return stats.map((s) => {
    const sourceTable = s.source_table as ExpenseTableName
    const raw = s.payment_method
    const rowCount = Number(s.row_count)
    const r = resolvePaymentMethodTarget(raw, pmRows)
    return {
      sourceTable,
      raw,
      rowCount,
      status: r.status,
      suggestedTargetId: r.suggestedTargetId,
      matchReason: r.matchReason,
      displayNameForTarget: r.displayNameForTarget,
    }
  })
}
