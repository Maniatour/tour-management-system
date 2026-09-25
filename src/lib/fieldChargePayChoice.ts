import { choiceProcessingFeeAmount, withChoiceProcessingFee } from '@/lib/choiceProcessingFee'

export type FieldPayMode = 'balance' | 'tip' | 'both'

const MIN_TIP_USD = 0.5

export function isFieldChargeInvoiceItems(items: unknown): boolean {
  if (!Array.isArray(items)) return false
  const openAmount = items.some((raw) => {
    const item = raw as { openAmount?: boolean | null; itemType?: string | null }
    if (item?.openAmount === true) return true
    return (item?.itemType || '').trim() === 'tip_open_amount'
  })
  if (openAmount) return false
  return items.some((raw) => (raw as { fieldCharge?: unknown })?.fieldCharge === true)
}

export function roundFieldUsd(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100
}

export function fieldBalanceCardCharge(balanceUsd: number): {
  balanceUsd: number
  cardFeeUsd: number
  cardChargeUsd: number
} {
  const balance = roundFieldUsd(balanceUsd)
  if (!Number.isFinite(balance) || balance <= 0.005) {
    return { balanceUsd: 0, cardFeeUsd: 0, cardChargeUsd: 0 }
  }
  const cardFeeUsd = choiceProcessingFeeAmount(balance)
  const cardChargeUsd = withChoiceProcessingFee(balance, true) ?? balance
  return { balanceUsd: balance, cardFeeUsd, cardChargeUsd }
}

export function canPayFieldBalance(params: {
  invoicePaid: boolean
  balanceUsd: number
  currency: string
}): boolean {
  return (
    !params.invoicePaid &&
    params.currency.toUpperCase() === 'USD' &&
    roundFieldUsd(params.balanceUsd) > 0.005
  )
}

export type FieldCheckoutPlan = {
  invoiceAmountUsd: number
  tipUsd: number
  cardFeeUsd: number
  balanceUsd: number
  retireHostedInvoice: boolean
}

/**
 * 현장 QR 결제 금액. 잔금은 서버가 계산한 값만 쓰고, 팁만 낼 때는 잔금 청구를 닫지 않습니다.
 */
export function resolveFieldCheckout(params: {
  mode: FieldPayMode
  invoicePaid: boolean
  balanceUsd: number
  currency: string
  tipUsd: number
}): { ok: true; plan: FieldCheckoutPlan } | { ok: false; reason: 'balance_settled' | 'tip_too_small' | 'unsupported_currency' } {
  if (params.currency.toUpperCase() !== 'USD') {
    return { ok: false, reason: 'unsupported_currency' }
  }

  const charge = fieldBalanceCardCharge(params.balanceUsd)
  const balancePayable = canPayFieldBalance({
    invoicePaid: params.invoicePaid,
    balanceUsd: charge.balanceUsd,
    currency: params.currency,
  })
  const tipUsd = roundFieldUsd(params.tipUsd)

  if (params.mode === 'tip') {
    if (!Number.isFinite(tipUsd) || tipUsd < MIN_TIP_USD) {
      return { ok: false, reason: 'tip_too_small' }
    }
    return {
      ok: true,
      plan: {
        invoiceAmountUsd: 0,
        tipUsd,
        cardFeeUsd: 0,
        balanceUsd: 0,
        retireHostedInvoice: !balancePayable,
      },
    }
  }

  if (!balancePayable) {
    return { ok: false, reason: 'balance_settled' }
  }

  if (params.mode === 'both' && (!Number.isFinite(tipUsd) || tipUsd < MIN_TIP_USD)) {
    return { ok: false, reason: 'tip_too_small' }
  }

  return {
    ok: true,
    plan: {
      invoiceAmountUsd: charge.cardChargeUsd,
      tipUsd: params.mode === 'balance' ? 0 : tipUsd,
      cardFeeUsd: charge.cardFeeUsd,
      balanceUsd: charge.balanceUsd,
      retireHostedInvoice: true,
    },
  }
}

export function fieldCheckoutSettlesInvoice(mode: FieldPayMode | ''): boolean {
  return mode !== 'tip'
}
