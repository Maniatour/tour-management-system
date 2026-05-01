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
