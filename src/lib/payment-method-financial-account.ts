/**
 * 지출 `payment_method` 값 → payment_methods 행 / financial_account_id 해석.
 * 지출에는 UUID id뿐 아니라 `CC8311`, `CC 8311`, `PAYM035` 등이 섞여 저장된다.
 */

export type PaymentMethodAccountRow = {
  id: string
  method?: string | null
  display_name?: string | null
  financial_account_id?: string | null
}

/** 공백·대소문자 무시 키 */
export function normalizePaymentMethodLookupKey(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

/** 카드 번호 자릿수만 (CC 8311 → 8311, CC8311 → 8311) */
export function paymentMethodCardDigitsKey(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length >= 4 && digits.length <= 8) return digits
  return null
}

function collectLookupKeys(row: PaymentMethodAccountRow): string[] {
  const keys = new Set<string>()
  const add = (v: string | null | undefined) => {
    const k = normalizePaymentMethodLookupKey(v)
    if (k) keys.add(k)
    const digits = paymentMethodCardDigitsKey(v)
    if (digits) keys.add(`digits:${digits}`)
  }
  add(row.id)
  add(row.method)
  add(row.display_name)
  // display_name «PAYM035 - CC 1129» → method 부분도 키로
  const dn = String(row.display_name ?? '').trim()
  const paymTail = dn.match(/^PAYM[\w-]+\s*-\s*(.+)$/i)
  if (paymTail?.[1]) add(paymTail[1])
  const paymHead = dn.match(/^(PAYM[\w-]+)\s*-/i)
  if (paymHead?.[1]) add(paymHead[1])
  return [...keys]
}

/**
 * payment_methods 목록으로 다키 인덱스 구축.
 * 동일 키에 여러 행이 있으면 financial_account_id 가 있는 쪽을 우선.
 */
export function buildPaymentMethodAccountIndex(
  rows: PaymentMethodAccountRow[]
): Map<string, PaymentMethodAccountRow> {
  const index = new Map<string, PaymentMethodAccountRow>()
  for (const row of rows) {
    if (!row?.id) continue
    for (const key of collectLookupKeys(row)) {
      const prev = index.get(key)
      if (!prev) {
        index.set(key, row)
        continue
      }
      const prevHas = Boolean(prev.financial_account_id)
      const nextHas = Boolean(row.financial_account_id)
      if (!prevHas && nextHas) index.set(key, row)
    }
  }
  return index
}

function lookupKeysForValue(raw: string): string[] {
  const keys = new Set<string>()
  const norm = normalizePaymentMethodLookupKey(raw)
  if (norm) keys.add(norm)
  const digits = paymentMethodCardDigitsKey(raw)
  if (digits) keys.add(`digits:${digits}`)
  // PAYM035 only
  const paymOnly = String(raw).trim().match(/^(PAYM[\w-]+)$/i)
  if (paymOnly?.[1]) keys.add(normalizePaymentMethodLookupKey(paymOnly[1]))
  return [...keys]
}

export function resolvePaymentMethodAccountRow(
  paymentMethodValue: string | null | undefined,
  index: Map<string, PaymentMethodAccountRow>
): PaymentMethodAccountRow | null {
  const raw = String(paymentMethodValue ?? '').trim()
  if (!raw) return null
  for (const key of lookupKeysForValue(raw)) {
    const hit = index.get(key)
    if (hit) return hit
  }
  return null
}

export function resolvePaymentMethodFinancialAccountId(
  paymentMethodValue: string | null | undefined,
  index: Map<string, PaymentMethodAccountRow>
): string | null {
  const row = resolvePaymentMethodAccountRow(paymentMethodValue, index)
  const fa = row?.financial_account_id
  return fa ? String(fa) : null
}
