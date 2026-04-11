/** 미국 거주자 구분(및 통합 그룹) 초이스 ↔ 예약 정보 거주 라인 동기화 */

export const US_RESIDENT_GROUP_LABELS = [
  '미국 거주자 구분',
  '미국 비거주자 구분',
  '기타 입장료',
  '미국 거주자 구분 및 기타 입장료',
] as const

export const UNDECIDED_OPTION_ID = '__undecided__'

/** DB `choice_options.id`(UUID) 조회용 — 미정 placeholder는 제외 */
export function choiceOptionIdsForSupabaseIn(
  optionIds: Iterable<string | null | undefined>
): string[] {
  const set = new Set<string>()
  for (const raw of optionIds) {
    const id = raw == null ? '' : String(raw).trim()
    if (!id || id === UNDECIDED_OPTION_ID) continue
    set.add(id)
  }
  return [...set]
}

export function undecidedOptionDisplayNames(): { name_ko: string; name_en: string } {
  return { name_ko: '미정', name_en: 'Undecided' }
}

export type ResidentLineKey =
  | 'undecided'
  | 'us_resident'
  | 'non_resident'
  | 'non_resident_under_16'
  | 'non_resident_with_pass'
  | 'non_resident_purchase_pass'

export const RESIDENT_LINE_KEYS: ResidentLineKey[] = [
  'undecided',
  'us_resident',
  'non_resident',
  'non_resident_under_16',
  'non_resident_with_pass',
  'non_resident_purchase_pass',
]

/** 예약 정보 거주 라인: 수량 1단위(명 또는 패스 장수)당 USD */
export const RESIDENT_LINE_USD_PER_UNIT: Record<ResidentLineKey, number> = {
  undecided: 0,
  us_resident: 0,
  non_resident: 100,
  non_resident_under_16: 0,
  non_resident_with_pass: 0,
  non_resident_purchase_pass: 250,
}

export function residentLineDefaultAmountUsd(lineKey: ResidentLineKey, quantity: number): number {
  const q = Math.max(0, Number(quantity) || 0)
  const rate = RESIDENT_LINE_USD_PER_UNIT[lineKey] ?? 0
  return Math.round(q * rate * 100) / 100
}

export function matchesUsResidentClassificationGroup(groupKo: string, groupEn: string): boolean {
  const g = (groupKo || '').trim()
  const e = (groupEn || '').toLowerCase()
  if (!g && !e) return false
  // 한글: 미국 + (거주/비거주) + 구분 — 상품명이 '미국 비거주자 구분' 등일 때도 거주 구분 초이스와 동일 UX
  if (g.includes('미국') && g.includes('구분') && (g.includes('거주') || g.includes('비거주'))) {
    return true
  }
  if (e.includes('resident') || e.includes('entrance') || e.includes('fee')) {
    if (e.includes('resident') || e.includes('us ')) return true
  }
  return US_RESIDENT_GROUP_LABELS.some(
    (label) => g === label || g.includes(label) || label.includes(g)
  )
}

export function isUsResidentClassificationProductChoice(choice: {
  choice_group_ko?: string | null
  choice_group?: string | null
}): boolean {
  return matchesUsResidentClassificationGroup(
    choice.choice_group_ko || '',
    (choice.choice_group || '').toLowerCase()
  )
}

/** product_choices 행 중 미국 거주자 구분 그룹 (첫 일치) */
export function findUsResidentClassificationChoice<
  T extends { id: string; choice_group_ko?: string | null; choice_group?: string | null }
>(productChoices: T[] | undefined | null): T | null {
  if (!productChoices?.length) return null
  return productChoices.find((c) => isUsResidentClassificationProductChoice(c)) || null
}

/** 옵션 메타 → 거주 라인 키 (미정은 옵션 행이 없고 UI 전용) */
export function classifyResidentOption(option: {
  option_name_ko?: string | null
  option_name?: string | null
  option_key?: string | null
}): Exclude<ResidentLineKey, 'undecided'> | null {
  const ko = (option.option_name_ko || '').replace(/\s+/g, ' ').trim()
  const name = (option.option_name || '').trim()
  const key = (option.option_key || '').toLowerCase()
  const blob = `${ko} ${name} ${key}`.toLowerCase()

  if (/패스\s*구매|패스구매|purchase.*pass|pass_purchase|buy.*pass/i.test(blob)) {
    return 'non_resident_purchase_pass'
  }
  if (/패스\s*보유|패스보유|with.*pass|has.*pass/i.test(blob)) {
    return 'non_resident_with_pass'
  }
  if (/미성년|16\s*세|under\s*16|minor/i.test(blob)) {
    return 'non_resident_under_16'
  }
  if (/미국/.test(ko) && /거주/.test(ko) && !/비/.test(ko)) {
    return 'us_resident'
  }
  if (/비\s*거주|비거주|non[-\s]?resident/i.test(blob)) {
    return 'non_resident'
  }
  return null
}

export type ResidentChoiceRow = {
  choice_id: string
  option_id: string
  option_key?: string
  option_name_ko?: string
  quantity: number
  total_price: number
}

export type ResidentLineState = {
  undecidedResidentCount: number
  usResidentCount: number
  nonResidentCount: number
  nonResidentUnder16Count: number
  nonResidentWithPassCount: number
  nonResidentPurchasePassCount: number
  residentStatusAmounts: Record<ResidentLineKey, number>
}

export function emptyResidentStatusAmounts(): Record<ResidentLineKey, number> {
  return {
    undecided: 0,
    us_resident: 0,
    non_resident: 0,
    non_resident_under_16: 0,
    non_resident_with_pass: 0,
    non_resident_purchase_pass: 0,
  }
}

/** 거주 상태별 금액 칸 중, 현장 불포함(비거주·패스 등)으로 합산할 USD (미정·미국 거주 제외) */
const RESIDENT_FEE_SUM_KEYS: ResidentLineKey[] = [
  'non_resident',
  'non_resident_under_16',
  'non_resident_with_pass',
  'non_resident_purchase_pass',
]

export function sumResidentFeeAmountsUsd(
  amounts: Partial<Record<ResidentLineKey, number>> | undefined | null
): number {
  if (!amounts) return 0
  let s = 0
  for (const k of RESIDENT_FEE_SUM_KEYS) {
    const v = Number(amounts[k])
    if (Number.isFinite(v) && v > 0) s += v
  }
  return Math.round(s * 100) / 100
}

function optionMeta(
  choice: { options?: Array<Record<string, unknown>> },
  optionId: string
): { option_name_ko?: string; option_name?: string; option_key?: string } | null {
  const opt = choice.options?.find((o) => (o as { id?: string }).id === optionId) as
    | { option_name_ko?: string; option_name?: string; option_key?: string }
    | undefined
  return opt || null
}

/** 선택 초이스에서 거주 라인 상태 추출 */
export function parseResidentLineStateFromSelections<
  T extends { choice_id: string; option_id: string; quantity?: number; total_price?: number }
>(
  productChoices: Array<{
    id: string
    choice_group_ko?: string | null
    choice_group?: string | null
    options?: Array<{ id: string; option_name_ko?: string; option_name?: string; option_key?: string }>
  }>,
  selectedChoices: T[]
): ResidentLineState | null {
  const choice = findUsResidentClassificationChoice(productChoices)
  if (!choice) return null

  const amounts = emptyResidentStatusAmounts()
  const counts: Omit<ResidentLineState, 'residentStatusAmounts'> = {
    undecidedResidentCount: 0,
    usResidentCount: 0,
    nonResidentCount: 0,
    nonResidentUnder16Count: 0,
    nonResidentWithPassCount: 0,
    nonResidentPurchasePassCount: 0,
  }

  const rows = selectedChoices.filter((s) => s.choice_id === choice.id)
  for (const s of rows) {
    const q = Math.max(0, Number(s.quantity) || 0)
    const price = Number(s.total_price) || 0
    if (s.option_id === UNDECIDED_OPTION_ID) {
      counts.undecidedResidentCount = q
      amounts.undecided = price
      continue
    }
    const meta = optionMeta(choice, s.option_id)
    const line = meta ? classifyResidentOption(meta) : null
    if (!line) continue
    switch (line) {
      case 'us_resident':
        counts.usResidentCount = q
        amounts.us_resident = price
        break
      case 'non_resident':
        counts.nonResidentCount = q
        amounts.non_resident = price
        break
      case 'non_resident_under_16':
        counts.nonResidentUnder16Count = q
        amounts.non_resident_under_16 = price
        break
      case 'non_resident_with_pass':
        counts.nonResidentWithPassCount = q
        amounts.non_resident_with_pass = price
        break
      case 'non_resident_purchase_pass':
        counts.nonResidentPurchasePassCount = q
        amounts.non_resident_purchase_pass = price
        break
      default:
        break
    }
  }

  return { ...counts, residentStatusAmounts: amounts }
}

/** 거주 라인 상태 → 해당 초이스 그룹용 selectedChoice 행 */
type ResidentOpt = {
  id: string
  option_name_ko?: string
  option_name?: string
  option_key?: string
}

export function buildResidentChoiceRowsFromLineState(
  choice: { id: string; options?: ResidentOpt[] },
  state: ResidentLineState,
  zeroPricesForOta: boolean
): ResidentChoiceRow[] {
  const rows: ResidentChoiceRow[] = []
  const optByLine = new Map<Exclude<ResidentLineKey, 'undecided'>, ResidentOpt>()
  for (const opt of choice.options || []) {
    const line = classifyResidentOption(opt)
    if (line && !optByLine.has(line)) optByLine.set(line, opt)
  }

  const price = (line: ResidentLineKey, qty: number) => {
    if (zeroPricesForOta || qty <= 0) return 0
    const v = state.residentStatusAmounts[line]
    return Number.isFinite(v) ? v : 0
  }

  if (state.undecidedResidentCount > 0) {
    rows.push({
      choice_id: choice.id,
      option_id: UNDECIDED_OPTION_ID,
      option_key: UNDECIDED_OPTION_ID,
      option_name_ko: '미정',
      quantity: state.undecidedResidentCount,
      total_price: price('undecided', state.undecidedResidentCount),
    })
  }

  const pushLine = (line: Exclude<ResidentLineKey, 'undecided'>, qty: number) => {
    if (qty <= 0) return
    const opt = optByLine.get(line)
    if (!opt) return
    rows.push({
      choice_id: choice.id,
      option_id: opt.id,
      option_key: opt.option_key,
      option_name_ko: opt.option_name_ko,
      quantity: qty,
      total_price: price(line, qty),
    })
  }

  pushLine('us_resident', state.usResidentCount)
  pushLine('non_resident', state.nonResidentCount)
  pushLine('non_resident_under_16', state.nonResidentUnder16Count)
  pushLine('non_resident_with_pass', state.nonResidentWithPassCount)
  pushLine('non_resident_purchase_pass', state.nonResidentPurchasePassCount)

  return rows
}

/** resident 그룹 행을 제외한 나머지 + 새 거주 행 병합 후 총액 */
export function mergeResidentRowsIntoSelectedChoices<
  T extends { choice_id: string; option_id: string; quantity?: number; total_price?: number }
>(
  productChoices: Parameters<typeof findUsResidentClassificationChoice>[0],
  selectedChoices: T[],
  residentRows: ResidentChoiceRow[]
): { selectedChoices: T[]; choicesTotal: number } {
  const choice = findUsResidentClassificationChoice(productChoices)
  const without = !choice
    ? [...selectedChoices]
    : selectedChoices.filter((s) => s.choice_id !== choice.id)
  const merged = [...without, ...(residentRows as T[])]
  const choicesTotal = merged.reduce((sum, c) => sum + (Number(c.total_price) || 0), 0)
  return { selectedChoices: merged, choicesTotal }
}

/** 패스 장수·다른 거주 인원·총원 기준 패스로 커버되는 인원 수 (기존 예약 폼과 동일) */
export function computePassCoveredCount(
  passCount: number,
  usResident: number,
  nonResident: number,
  nonResidentUnder16: number,
  totalPeople: number
): number {
  const maxCoverable = passCount * 4
  const remainingPeople = totalPeople - usResident - nonResident - nonResidentUnder16
  return Math.min(maxCoverable, Math.max(0, remainingPeople))
}

export function residentLineStateEquals(a: ResidentLineState, b: ResidentLineState): boolean {
  if (
    a.undecidedResidentCount !== b.undecidedResidentCount ||
    a.usResidentCount !== b.usResidentCount ||
    a.nonResidentCount !== b.nonResidentCount ||
    a.nonResidentUnder16Count !== b.nonResidentUnder16Count ||
    a.nonResidentWithPassCount !== b.nonResidentWithPassCount ||
    a.nonResidentPurchasePassCount !== b.nonResidentPurchasePassCount
  ) {
    return false
  }
  for (const k of RESIDENT_LINE_KEYS) {
    if ((a.residentStatusAmounts[k] || 0) !== (b.residentStatusAmounts[k] || 0)) return false
  }
  return true
}

/** Parse stored rows from reservation_pricing.choices.required (email). */
export function selectedChoiceRowsFromReservationPricingChoices(choicesJson: unknown): Array<{
  choice_id: string
  option_id: string
  quantity?: number
  total_price?: number
}> {
  if (!choicesJson || typeof choicesJson !== 'object') return []
  const o = choicesJson as Record<string, unknown>
  const req = o.required
  if (!Array.isArray(req)) return []
  const out: Array<{
    choice_id: string
    option_id: string
    quantity?: number
    total_price?: number
  }> = []
  for (const item of req) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const choiceId =
      row.choice_id != null ? String(row.choice_id) : row.id != null ? String(row.id) : ''
    const optionId = row.option_id != null ? String(row.option_id) : ''
    if (!choiceId || !optionId) continue
    out.push({
      choice_id: choiceId,
      option_id: optionId,
      quantity: Number(row.quantity) || 0,
      total_price: Number(row.total_price) || 0,
    })
  }
  return out
}

export type ProductChoiceRowForResidentFees = {
  id: string
  choice_group_ko?: string | null
  choice_group?: string | null
  options?: Array<{
    id: string
    option_name_ko?: string | null
    option_name?: string | null
    option_key?: string | null
  }>
}

/**
 * 예약 시점의 `choices.required[].total_price`와 상품 `product_choices` 메타로
 * Non-resident / pass on-site fees (USD) for customer email totals.
 */
export function sumResidentFeesFromStoredChoices(
  productChoices: ProductChoiceRowForResidentFees[],
  choicesJson: unknown
): number {
  if (!productChoices?.length) return 0
  const rows = selectedChoiceRowsFromReservationPricingChoices(choicesJson)
  if (!rows.length) return 0
  const state = parseResidentLineStateFromSelections(productChoices, rows)
  if (!state) return 0
  return sumResidentFeeAmountsUsd(state.residentStatusAmounts)
}
