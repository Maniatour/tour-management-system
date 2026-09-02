import {
  adjustOptionTotalExcludingLegacyNonResident,
  computeCustomerPaymentTotalLineFormula,
  getBalanceAmountForDisplay,
  inferResidentFeesUsdForBalance,
  paymentRecordAmountToNumber,
  residentFeesUsdFromCustomerRows,
  withNormalizedBalanceAmountForDisplay,
  type PartySizeSource,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'

export type AssignedBalanceOptionRow = {
  option_id?: string | null
  total_price?: unknown
  status?: string | null
}

export type AssignedBalanceReservationInput = {
  id: string
  status?: string | null
  adults?: number | null
  children?: number | null
  child?: number | null
  infants?: number | null
  infant?: number | null
}

/** 배정 관리 헤더·카드 잔액 뱃지와 동일한 산식 */
export function computeAssignedReservationDisplayBalance(args: {
  reservation: AssignedBalanceReservationInput
  pricing: Record<string, unknown> | undefined
  paymentRecords: PaymentRecordLike[]
  optionRows: AssignedBalanceOptionRow[]
  customerRows: Array<{ resident_status?: string | null }>
}): number {
  const { reservation, pricing, paymentRecords, optionRows, customerRows } = args
  if (!pricing) return 0

  const paRaw = pricing.pricing_adults
  const hasPa =
    paRaw !== undefined &&
    paRaw !== null &&
    paRaw !== '' &&
    Number.isFinite(Number(paRaw)) &&
    Math.floor(Number(paRaw)) >= 0
  const party: PartySizeSource = {
    adults: hasPa ? Math.floor(Number(paRaw)) : (reservation.adults ?? null),
    children: (reservation.children ?? reservation.child ?? null) as number | null,
    infants: (reservation.infants ?? reservation.infant ?? null) as number | null,
  }

  const activeOpts = optionRows.filter((row) => {
    const st = String(row.status ?? 'active').toLowerCase()
    return st !== 'cancelled' && st !== 'refunded'
  })
  const hasLiveOptionRows = optionRows.length > 0
  const rawOptionsTotal = hasLiveOptionRows
    ? activeOpts.reduce((sum, row) => sum + paymentRecordAmountToNumber(row.total_price), 0)
    : null

  const fromCustomers = residentFeesUsdFromCustomerRows(customerRows)
  const pricingNorm = withNormalizedBalanceAmountForDisplay(pricing)
  const lineGrossBase = computeCustomerPaymentTotalLineFormula(
    {
      ...(pricingNorm as Parameters<typeof computeCustomerPaymentTotalLineFormula>[0]),
      required_option_total:
        rawOptionsTotal !== null
          ? 0
          : (pricingNorm as { required_option_total?: unknown }).required_option_total,
      option_total: rawOptionsTotal !== null ? rawOptionsTotal : pricingNorm.option_total,
    },
    party
  )
  const residentFeeUsd = inferResidentFeesUsdForBalance(pricingNorm, lineGrossBase, fromCustomers)
  const optionsTotalFromOptions =
    rawOptionsTotal !== null
      ? adjustOptionTotalExcludingLegacyNonResident(rawOptionsTotal, residentFeeUsd, activeOpts)
      : null

  return getBalanceAmountForDisplay(pricingNorm, optionsTotalFromOptions, party, {
    paymentRecords,
    reservationStatus: reservation.status ?? null,
    residentFeeUsd,
  })
}
