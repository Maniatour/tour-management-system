/**
 * 결제수단 UI 표시 통일: 레거시 «PAYM006 - CC 0602» → «CC 0602 (Joey)»
 * - 카드/방법 줄: `method` 우선, 없으면 `display_name`에서 PAYM 접두 제거
 * - 괄호 안: `card_holder_name` → team `nick_name` → `name_en` → `name_ko`
 */

export type PaymentMethodDisplayPm = {
  id: string
  method?: string | null
  display_name?: string | null
  user_email?: string | null
  card_holder_name?: string | null
}

export type PaymentMethodDisplayTeam = {
  email?: string | null
  name_ko?: string | null
  name_en?: string | null
  nick_name?: string | null
} | null | undefined

const PAYM_PREFIX_DISPLAY = /^PAYM[\w-]+\s*-\s*/i

/**
 * `payment_methods.method`가 채널·정산용인 경우: linked `user_email`/team은 소유자 표시가 아니므로
 * «Partner Received (직원명)»처럼 붙이지 않고 방법명만 표시한다.
 */
const METHOD_NAMES_WITHOUT_PERSON_SUFFIX = new Set(
  ['partner received', "customer's cc charged", 'commission received !'].map((s) => s.toLowerCase())
)

function shouldSuppressPersonSuffixForMethodName(methodLabel: string): boolean {
  return METHOD_NAMES_WITHOUT_PERSON_SUFFIX.has(methodLabel.trim().toLowerCase())
}

/** 레거시 «PAYMxxx - CC 0602» 또는 method만 */
export function extractPaymentMethodCardLabel(
  displayName: string | null | undefined,
  method: string | null | undefined
): string {
  const methodTrim = (method && method.trim()) || ''
  if (methodTrim) return methodTrim
  const d = (displayName && displayName.trim()) || ''
  if (!d) return ''
  const m = d.match(/^PAYM[\w-]+\s*-\s*(.+)$/i)
  if (m) return m[1].trim()
  if (d.includes(' - ')) {
    const head = d.split(' - ')[0]?.trim() || ''
    if (/^PAYM/i.test(head)) {
      return d.split(' - ').pop()!.trim()
    }
  }
  return d
}

/** DB 저장용(관리 API): PAYM ID 없이 표시명만 */
export function buildPaymentMethodStoredDisplayName(input: {
  method: string
  card_holder_name?: string | null
}): string {
  const method = (input.method && input.method.trim()) || ''
  const holder = (input.card_holder_name && String(input.card_holder_name).trim()) || ''
  if (method && holder && holder.toLowerCase() !== method.toLowerCase()) {
    return `${method} (${holder})`
  }
  return method
}

export function formatPaymentMethodDisplay(
  pm: PaymentMethodDisplayPm,
  team?: PaymentMethodDisplayTeam
): string {
  const id = (pm.id && pm.id.trim()) || ''
  const dnRaw = pm.display_name?.trim() || ''

  if (dnRaw && !PAYM_PREFIX_DISPLAY.test(dnRaw)) {
    return dnRaw
  }

  const cardPart = extractPaymentMethodCardLabel(pm.display_name, pm.method)
  if (cardPart && shouldSuppressPersonSuffixForMethodName(cardPart)) {
    return cardPart
  }
  const holder = (pm.card_holder_name && pm.card_holder_name.trim()) || ''
  let person = holder
  if (!person && team) {
    person =
      (team.nick_name && team.nick_name.trim()) ||
      (team.name_en && team.name_en.trim()) ||
      (team.name_ko && team.name_ko.trim()) ||
      ''
  }
  if (person && cardPart && person === cardPart) {
    person = ''
  }
  if (cardPart && person) return `${cardPart} (${person})`
  if (cardPart) return cardPart
  if (dnRaw) {
    const stripped = dnRaw.replace(PAYM_PREFIX_DISPLAY, '').trim()
    return stripped || id
  }
  return id
}

const PAYM_ID_ONLY = /^PAYM[\w-]+$/i
const SHORT_HEX_ID = /^[0-9a-f]{8}$/i

const BUILTIN_PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: '은행 이체',
  cash: '현금',
  card: '카드',
  stripe: 'Stripe',
  paypal: 'PayPal',
  other: '기타',
}

function looksLikePaymentMethodId(value: string, id?: string): boolean {
  const v = value.trim()
  if (!v) return true
  if (id && v === id.trim()) return true
  if (PAYM_ID_ONLY.test(v)) return true
  if (SHORT_HEX_ID.test(v)) return true
  return false
}

/** Master row → 방법명 (`method`). ID·PAYM 코드가 방법명인 행은 display_name에서 이름을 꺼낸다. */
export function paymentMethodNameFromRow(pm: {
  id?: string | null
  method?: string | null
  display_name?: string | null
}): string {
  const id = (pm.id || '').trim()
  const method = (pm.method || '').trim()
  const fromDisplay = extractPaymentMethodCardLabel(pm.display_name, null)

  if (method && !looksLikePaymentMethodId(method, id)) return method
  if (
    fromDisplay &&
    fromDisplay !== id &&
    !looksLikePaymentMethodId(fromDisplay, id)
  ) {
    return fromDisplay
  }
  if (method) return method
  if (fromDisplay) return fromDisplay
  return id
}

function putPaymentMethodLabel(
  map: Record<string, string>,
  key: string | null | undefined,
  label: string
) {
  const k = String(key || '').trim()
  if (!k || !label) return
  map[k] = label
  const lower = k.toLowerCase()
  if (lower !== k) map[lower] = label
}

/** `payment_methods` 행 → 저장된 id/방법명으로 방법명을 찾기 위한 맵 */
export function buildPaymentMethodLabelMap(
  rows: Array<{
    id?: string | null
    method?: string | null
    display_name?: string | null
  }>
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const pm of rows) {
    const label = paymentMethodNameFromRow(pm)
    if (!label) continue
    putPaymentMethodLabel(map, pm.id, label)
    putPaymentMethodLabel(map, pm.method, label)
  }
  return map
}

/** 입금 내역 등에 저장된 값(PAYM id, 짧은 hex id, 방법명) → 항상 방법명 */
export function lookupPaymentMethodLabel(
  stored: string | null | undefined,
  map: Record<string, string>
): string {
  const raw = String(stored ?? '').trim()
  if (!raw) return ''
  const direct = map[raw] || map[raw.toLowerCase()]
  if (direct) return direct

  const stripped = extractPaymentMethodCardLabel(raw, null)
  if (stripped) {
    const fromStripped = map[stripped] || map[stripped.toLowerCase()]
    if (fromStripped) return fromStripped
  }

  const builtin = BUILTIN_PAYMENT_METHOD_LABELS[raw.toLowerCase()]
  if (builtin) return builtin

  if (stripped && stripped !== raw && !looksLikePaymentMethodId(stripped)) return stripped
  return raw
}
