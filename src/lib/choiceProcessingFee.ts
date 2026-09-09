/** 초이스 그룹 카드 결제 수수료 (5%) */

export const CHOICE_CARD_PROCESSING_FEE_RATE = 0.05

export function parseApplyProcessingFee(value: unknown): boolean {
  return value === true
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** 원금액에 붙는 5% 수수료 */
export function choiceProcessingFeeAmount(baseAmount: number): number {
  const n = Number(baseAmount) || 0
  if (n <= 0) return 0
  return roundMoney(n * CHOICE_CARD_PROCESSING_FEE_RATE)
}

/** 수수료 적용 시 고객에게 보이는/청구되는 금액 */
export function withChoiceProcessingFee(
  baseAmount: number | null | undefined,
  apply: boolean
): number | null {
  if (baseAmount == null) return null
  const n = Number(baseAmount)
  if (!Number.isFinite(n)) return null
  if (!apply || n <= 0) return n
  return roundMoney(n + choiceProcessingFeeAmount(n))
}
