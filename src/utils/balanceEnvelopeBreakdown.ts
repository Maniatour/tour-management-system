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

const RESIDENT_LINE_LABELS: Record<
  (typeof RESIDENT_FEE_SUM_KEYS)[number],
  { ko: string; en: string }
> = {
  non_resident: { ko: '비 거주자', en: 'non-resident' },
  non_resident_under_16: { ko: '비 거주자 (미성년)', en: 'non-resident (under 16)' },
  non_resident_with_pass: { ko: '비 거주자 (패스보유)', en: 'non-resident (w/ pass)' },
  non_resident_purchase_pass: { ko: '비 거주자 (패스 구매)', en: 'pass purchase' },
}

export type ResidentStatusCounts = Partial<Record<ResidentLineKey, number>>

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

  const amounts = residentAmountsFromCounts(residentCounts, residentStatusAmounts)
  const { baseUsd, residentFeesUsd } = splitNotIncludedForDisplay(
    0,
    0,
    notIncludedPerPerson,
    pricingAdults,
    child,
    infant,
    amounts as Record<string, number>
  )

  const lines: BalanceEnvelopeLine[] = []

  for (const key of RESIDENT_FEE_SUM_KEYS) {
    const qty = Math.max(0, Math.floor(Number(residentCounts[key]) || 0))
    const subtotal = roundUsd2(Number(amounts[key]) || 0)
    if (qty <= 0 || subtotal < 0.005) continue
    const defaultUnit = RESIDENT_LINE_USD_PER_UNIT[key] ?? 0
    const unitPrice =
      qty > 0 && subtotal > 0
        ? roundUsd2(subtotal / qty)
        : defaultUnit
    const labels = RESIDENT_LINE_LABELS[key]
    lines.push({
      labelKo: labels.ko,
      labelEn: labels.en,
      unitPrice,
      qty,
      subtotal,
    })
  }

  const billingPax = Math.max(0, (pricingAdults || 0) + (child || 0) + (infant || 0))
  if (baseUsd > 0.005 && billingPax > 0) {
    const perPerson =
      notIncludedPerPerson > 0.005
        ? roundUsd2(notIncludedPerPerson)
        : roundUsd2(baseUsd / billingPax)
    lines.push({
      labelKo: '미포함 (입장권)',
      labelEn: 'Not included price (Entrance Fee)',
      unitPrice: perPerson,
      qty: billingPax,
      subtotal: roundUsd2(baseUsd),
    })
  } else if (baseUsd > 0.005) {
    lines.push({
      labelKo: '미포함 (입장권)',
      labelEn: 'Not included price (Entrance Fee)',
      unitPrice: roundUsd2(baseUsd),
      qty: 1,
      subtotal: roundUsd2(baseUsd),
    })
  }

  for (const opt of reservationOptions || []) {
    const subtotal = roundUsd2(Number(opt.subtotal) || 0)
    if (subtotal < 0.005) continue
    const qty = Math.max(1, Math.floor(Number(opt.qty) || 0))
    const unitPrice =
      qty > 0 && subtotal > 0
        ? roundUsd2(subtotal / qty)
        : roundUsd2(Number(opt.unitPrice) || 0)
    lines.push({
      labelKo: opt.labelKo || opt.labelEn,
      labelEn: opt.labelEn || opt.labelKo,
      unitPrice,
      qty,
      subtotal,
    })
  }

  const partsSum = roundUsd2(lines.reduce((s, l) => s + l.subtotal, 0))
  const target = roundUsd2(Math.max(0, balanceAmount))
  const gap = roundUsd2(target - partsSum)

  if (gap > 0.02) {
    lines.push({
      labelKo: '기타',
      labelEn: 'other',
      unitPrice: gap,
      qty: 1,
      subtotal: gap,
    })
  } else if (gap < -0.02 && lines.length > 0) {
    const last = lines[lines.length - 1]
    last.subtotal = roundUsd2(Math.max(0, last.subtotal + gap))
    if (last.qty > 0) {
      last.unitPrice = roundUsd2(last.subtotal / last.qty)
    }
  }

  return lines
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
