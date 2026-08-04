import { splitNotIncludedForDisplay, roundUsd2 } from '@/utils/pricingSectionDisplay'
import {
  RESIDENT_FEE_SUM_KEYS,
  RESIDENT_LINE_USD_PER_UNIT,
  type ResidentLineKey,
  residentLineDefaultAmountUsd,
} from '@/utils/usResidentChoiceSync'

export type BalanceEnvelopeLine = {
  labelKo: string
  labelEn: string
  unitPrice: number
  qty: number
  subtotal: number
}

const RESIDENT_LINE_LABELS: Record<ResidentLineKey, { ko: string; en: string }> = {
  undecided: { ko: '미정', en: 'undecided' },
  us_resident: { ko: '미국 거주자', en: 'US resident' },
  non_resident: { ko: '비 거주자', en: 'non-resident' },
  non_resident_under_16: { ko: '비 거주자 (미성년)', en: 'non-resident (under 16)' },
  non_resident_with_pass: { ko: '비 거주자 (패스보유)', en: 'non-resident (w/ pass)' },
  non_resident_purchase_pass: { ko: '비 거주자 (패스 구매)', en: 'pass purchase' },
}

export type ResidentStatusCounts = Partial<Record<ResidentLineKey, number>>

type BalanceEnvelopeCandidate = BalanceEnvelopeLine & {
  source: 'resident' | 'not_included' | 'option'
}

const BALANCE_MATCH_EPS = 0.02

function nearlyEqualUsd(a: number, b: number): boolean {
  return Math.abs(roundUsd2(a) - roundUsd2(b)) <= BALANCE_MATCH_EPS
}

function classifyOptionResidentLineKey(labelKo: string, labelEn: string): ResidentLineKey | null {
  const blob = `${labelKo || ''} ${labelEn || ''}`.toLowerCase()
  if (/패스\s*구매|pass\s*purchase/.test(blob)) return 'non_resident_purchase_pass'
  if ((/패스|pass/.test(blob) && /비|non/.test(blob)) || /with\s*pass/.test(blob)) {
    return 'non_resident_with_pass'
  }
  if (/16|미성년|under\s*16/.test(blob)) return 'non_resident_under_16'
  if (/비\s*거주|비거주|non[-\s]?resident/.test(blob)) return 'non_resident'
  return null
}

export function isNonResidentFeeOptionLabel(labelKo: string, labelEn: string): boolean {
  return classifyOptionResidentLineKey(labelKo, labelEn) !== null
}

/** 거주 상태별 인원·금액 → 영수증·봉투 표시용 라인 */
export function buildResidentFeeDisplayLines(
  residentCounts: ResidentStatusCounts,
  residentStatusAmounts?: Partial<Record<ResidentLineKey, number>> | null
): BalanceEnvelopeLine[] {
  const amounts = residentAmountsFromCounts(residentCounts, residentStatusAmounts)
  const lines: BalanceEnvelopeLine[] = []

  for (const key of RESIDENT_FEE_SUM_KEYS) {
    let qty = Math.max(0, Math.floor(Number(residentCounts[key]) || 0))
    let subtotal = roundUsd2(Number(amounts[key]) || 0)
    // 금액만 저장된 경우(인원 행 없음): 단가로 수량 추정
    if (qty <= 0) {
      const override = residentStatusAmounts?.[key]
      if (override !== undefined && Number(override) > 0.005) {
        subtotal = roundUsd2(Number(override))
        const unit = RESIDENT_LINE_USD_PER_UNIT[key] ?? 0
        qty = unit > 0.005 ? Math.max(1, Math.round(subtotal / unit)) : 1
      }
    }
    if (qty <= 0) continue
    if (subtotal < 0.005) {
      subtotal = residentLineDefaultAmountUsd(key, qty)
    }
    if (subtotal < 0.005) continue
    const defaultUnit = RESIDENT_LINE_USD_PER_UNIT[key] ?? 0
    const unitPrice =
      qty > 0 && subtotal > 0 ? roundUsd2(subtotal / qty) : defaultUnit
    const labels = RESIDENT_LINE_LABELS[key]
    lines.push({
      labelKo: labels.ko,
      labelEn: labels.en,
      unitPrice,
      qty,
      subtotal,
    })
  }

  return lines
}

function optionLineFromInput(
  opt: BalanceEnvelopeOptionInput,
  balanceAmount: number
): BalanceEnvelopeLine {
  const qty = Math.max(1, Math.floor(Number(opt.qty) || 0))
  const storedSubtotal = roundUsd2(Number(opt.subtotal) || 0)
  const residentKey = classifyOptionResidentLineKey(opt.labelKo, opt.labelEn)

  if (residentKey && residentKey !== 'undecided' && residentKey !== 'us_resident') {
    const expectedSubtotal = residentLineDefaultAmountUsd(residentKey, qty)
    if (nearlyEqualUsd(balanceAmount, expectedSubtotal)) {
      const unit = RESIDENT_LINE_USD_PER_UNIT[residentKey] ?? roundUsd2(expectedSubtotal / qty)
      return {
        labelKo: opt.labelKo || RESIDENT_LINE_LABELS[residentKey].ko,
        labelEn: opt.labelEn || RESIDENT_LINE_LABELS[residentKey].en,
        unitPrice: unit,
        qty,
        subtotal: expectedSubtotal,
      }
    }
  }

  const unitPrice =
    qty > 0 && storedSubtotal > 0
      ? roundUsd2(storedSubtotal / qty)
      : roundUsd2(Number(opt.unitPrice) || 0)

  return {
    labelKo: opt.labelKo || opt.labelEn,
    labelEn: opt.labelEn || opt.labelKo,
    unitPrice,
    qty,
    subtotal: storedSubtotal,
  }
}

function findExactSumSubsetIndices(
  items: Array<{ subtotal: number }>,
  target: number
): number[] | null {
  const n = items.length
  if (n === 0) return null

  let best: number[] | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (let mask = 1; mask < 1 << n; mask++) {
    const indices: number[] = []
    let sum = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        indices.push(i)
        sum += items[i].subtotal
      }
    }
    if (!nearlyEqualUsd(sum, target)) continue

    const score = indices.length * 1000 - Math.max(...indices.map((i) => items[i].subtotal))
    if (score < bestScore) {
      bestScore = score
      best = indices
    }
  }

  return best
}

function findAllExactSumSubsets(candidates: BalanceEnvelopeCandidate[], target: number): BalanceEnvelopeCandidate[][] {
  const n = candidates.length
  const subsets: BalanceEnvelopeCandidate[][] = []

  for (let mask = 1; mask < 1 << n; mask++) {
    const subset: BalanceEnvelopeCandidate[] = []
    let sum = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        subset.push(candidates[i])
        sum += candidates[i].subtotal
      }
    }
    if (nearlyEqualUsd(sum, target)) subsets.push(subset)
  }

  return subsets
}

function scoreBalanceSubset(subset: BalanceEnvelopeCandidate[]): number {
  const lineCount = subset.length
  const maxSubtotal = Math.max(...subset.map((l) => l.subtotal), 0)
  const optionLines = subset.filter((l) => l.source === 'option').length
  const residentLines = subset.filter((l) => l.source === 'resident' || l.source === 'not_included').length
  const singleOptionExact =
    subset.length === 1 && subset[0].source === 'option' ? -50000 : 0

  return (
    lineCount * 100000 -
    maxSubtotal * 100 -
    residentLines * 1000 +
    optionLines * 10 +
    singleOptionExact
  )
}

function pickBestMatchingLines(
  candidates: BalanceEnvelopeCandidate[],
  target: number
): BalanceEnvelopeLine[] {
  if (target < 0.005) return []

  const optionCandidates = candidates.filter((c) => c.source === 'option')
  for (const c of optionCandidates) {
    if (nearlyEqualUsd(c.subtotal, target)) {
      return [stripCandidateSource(c)]
    }
  }

  const residentCandidates = candidates.filter((c) => c.source === 'resident' || c.source === 'not_included')
  for (const c of residentCandidates) {
    if (nearlyEqualUsd(c.subtotal, target)) {
      return [stripCandidateSource(c)]
    }
  }

  const exactSubsets = findAllExactSumSubsets(candidates, target)
  if (exactSubsets.length > 0) {
    exactSubsets.sort((a, b) => scoreBalanceSubset(a) - scoreBalanceSubset(b))
    return exactSubsets[0].map(stripCandidateSource)
  }

  const optionOnlySubsets = findAllExactSumSubsets(optionCandidates, target)
  if (optionOnlySubsets.length > 0) {
    optionOnlySubsets.sort((a, b) => scoreBalanceSubset(a) - scoreBalanceSubset(b))
    return optionOnlySubsets[0].map(stripCandidateSource)
  }

  const residentOnlySubsets = findAllExactSumSubsets(residentCandidates, target)
  if (residentOnlySubsets.length > 0) {
    residentOnlySubsets.sort((a, b) => scoreBalanceSubset(a) - scoreBalanceSubset(b))
    return residentOnlySubsets[0].map(stripCandidateSource)
  }

  return [
    {
      labelKo: '잔액',
      labelEn: 'Balance',
      unitPrice: target,
      qty: 1,
      subtotal: target,
    },
  ]
}

function stripCandidateSource(line: BalanceEnvelopeCandidate): BalanceEnvelopeLine {
  return {
    labelKo: line.labelKo,
    labelEn: line.labelEn,
    unitPrice: line.unitPrice,
    qty: line.qty,
    subtotal: line.subtotal,
  }
}

function excludePrepaidOptionLines(
  optionLines: BalanceEnvelopeCandidate[],
  target: number
): BalanceEnvelopeCandidate[] {
  const optionSum = roundUsd2(optionLines.reduce((s, l) => s + l.subtotal, 0))
  const prepaid = roundUsd2(optionSum - target)
  if (prepaid < BALANCE_MATCH_EPS) return optionLines

  const excludeIndices = findExactSumSubsetIndices(optionLines, prepaid)
  if (!excludeIndices?.length) return optionLines

  const excludeSet = new Set(excludeIndices)
  return optionLines.filter((_, i) => !excludeSet.has(i))
}

/** reservation_customers 행 → 거주 라인별 인원 */
export function countResidentLinesFromCustomers(
  rows: Array<{ resident_status?: string | null }> | null | undefined
): ResidentStatusCounts {
  const out: ResidentStatusCounts = {}
  for (const r of rows || []) {
    const s = (r.resident_status || '').trim()
    if (!s) continue
    if (
      s === 'non_resident' ||
      s === 'non_resident_under_16' ||
      s === 'non_resident_with_pass' ||
      s === 'non_resident_purchase_pass'
    ) {
      const key = s as ResidentLineKey
      out[key] = (out[key] || 0) + 1
    }
  }
  return out
}

function residentAmountsFromCounts(
  counts: ResidentStatusCounts,
  overrides?: Partial<Record<ResidentLineKey, number>> | null
): Partial<Record<ResidentLineKey, number>> {
  const amounts: Partial<Record<ResidentLineKey, number>> = {}
  for (const key of RESIDENT_FEE_SUM_KEYS) {
    const qty = Math.max(0, Math.floor(Number(counts[key]) || 0))
    if (qty <= 0) continue
    const override = overrides?.[key]
    amounts[key] =
      override !== undefined && Number.isFinite(Number(override)) && Number(override) >= 0
        ? roundUsd2(Number(override))
        : residentLineDefaultAmountUsd(key, qty)
  }
  return amounts
}

/** `reservation_customers` 인원 + (선택) 저장 금액 → 비거주·패스 등 현장 비용 USD 합 */
export function sumResidentFeesFromResidentCounts(
  counts: ResidentStatusCounts,
  overrides?: Partial<Record<ResidentLineKey, number>> | null
): number {
  const amounts = residentAmountsFromCounts(counts, overrides)
  let sum = 0
  for (const key of RESIDENT_FEE_SUM_KEYS) {
    const v = Number(amounts[key]) || 0
    if (v > 0) sum += v
  }
  return roundUsd2(sum)
}

export type BalanceEnvelopeOptionInput = {
  labelKo: string
  labelEn: string
  unitPrice: number
  qty: number
  subtotal: number
}

export function buildBalanceEnvelopeBreakdownLines(input: {
  balanceAmount: number
  notIncludedPerPerson: number
  pricingAdults: number
  child: number
  infant: number
  residentCounts: ResidentStatusCounts
  /** reservation_choices·폼에서 온 거주 라인 USD (있으면 우선) */
  residentStatusAmounts?: Partial<Record<ResidentLineKey, number>> | null
  /** reservation_options 행 (이름·단가·수량) */
  reservationOptions?: BalanceEnvelopeOptionInput[] | null
}): BalanceEnvelopeLine[] {
  const {
    balanceAmount,
    notIncludedPerPerson,
    pricingAdults,
    child,
    infant,
    residentCounts,
    residentStatusAmounts,
    reservationOptions,
  } = input

  const target = roundUsd2(Math.max(0, balanceAmount))
  if (target < 0.005) return []

  const amounts = residentAmountsFromCounts(residentCounts, residentStatusAmounts)
  const { baseUsd } = splitNotIncludedForDisplay(
    0,
    0,
    notIncludedPerPerson,
    pricingAdults,
    child,
    infant,
    amounts as Record<string, number>
  )

  const candidates: BalanceEnvelopeCandidate[] = buildResidentFeeDisplayLines(
    residentCounts,
    residentStatusAmounts
  ).map((line) => ({ ...line, source: 'resident' as const }))

  const billingPax = Math.max(0, (pricingAdults || 0) + (child || 0) + (infant || 0))
  if (baseUsd > 0.005 && billingPax > 0) {
    const perPerson =
      notIncludedPerPerson > 0.005
        ? roundUsd2(notIncludedPerPerson)
        : roundUsd2(baseUsd / billingPax)
    candidates.push({
      labelKo: '미포함 (입장권)',
      labelEn: 'Not included price (Entrance Fee)',
      unitPrice: perPerson,
      qty: billingPax,
      subtotal: roundUsd2(baseUsd),
      source: 'not_included',
    })
  } else if (baseUsd > 0.005) {
    candidates.push({
      labelKo: '미포함 (입장권)',
      labelEn: 'Not included price (Entrance Fee)',
      unitPrice: roundUsd2(baseUsd),
      qty: 1,
      subtotal: roundUsd2(baseUsd),
      source: 'not_included',
    })
  }

  const hasResidentFeeLine = candidates.some((c) => c.source === 'resident')

  let optionCandidates: BalanceEnvelopeCandidate[] = []
  for (const opt of reservationOptions || []) {
    const line = optionLineFromInput(opt, target)
    if (line.subtotal < 0.005) continue

    if (hasResidentFeeLine && isNonResidentFeeOptionLabel(line.labelKo, line.labelEn)) {
      continue
    }

    optionCandidates.push({ ...line, source: 'option' })
  }

  optionCandidates = excludePrepaidOptionLines(optionCandidates, target)

  return pickBestMatchingLines([...candidates, ...optionCandidates], target)
}

export function formatBalanceEnvelopeLine(
  line: BalanceEnvelopeLine,
  currency: string,
  useEnglish: boolean,
  formatMoney: (amount: number, currency: string) => string
): string {
  const label = useEnglish ? line.labelEn : line.labelKo
  return `${label} ${formatMoney(line.unitPrice, currency)} x ${line.qty} = ${formatMoney(line.subtotal, currency)}`
}
