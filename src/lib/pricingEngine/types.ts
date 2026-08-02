import type { PaymentRecordLike } from '@/utils/reservationPricingBalance'

/** 계산 시나리오 — 채널 × 예약 상태 조합 */
export type PricingProfileId =
  | 'SELF_ACTIVE'
  | 'SELF_CANCELLED'
  | 'SELF_NO_SHOW'
  | 'OTA_ACTIVE'
  | 'OTA_CANCELLED'
  | 'OTA_NO_SHOW'
  | 'PARTNER_ACTIVE'
  | 'OTHER'

export type PricingLedgerLine = {
  id: string
  sign: '+' | '-' | '='
  labelKo: string
  labelEn: string
  amount: number
}

export type PricingLayerResult = {
  /** 레이어 합계 (라인에서 유도) */
  total: number
  lines: PricingLedgerLine[]
}

export type ReservationPricingResult = {
  profile: PricingProfileId
  profileLabelKo: string
  profileLabelEn: string
  /** ① 고객 결제 */
  customer: PricingLayerResult
  /** ②③ 채널 결제·정산 */
  channel: PricingLayerResult
  /** ④ 회사 매출·운영 이익 */
  company: PricingLayerResult
  totals: {
    customerPaymentGross: number
    customerPaymentNet: number
    onSiteBalance: number
    channelPaymentNet: number
    channelSettlement: number
    companyTotalRevenue: number
    operatingProfit: number
  }
}

/** 새 엔진 입력 — UI·API·DB 어디서든 동일하게 조립 */
export type PricingEngineContext = {
  reservationStatus: string | null | undefined
  channelId: string | null | undefined
  isOtaChannel: boolean
  isHomepageBooking: boolean

  adults: number
  children: number
  infants: number
  pricingAdults: number

  productPriceTotal: number
  adultProductPrice: number
  childProductPrice: number
  infantProductPrice: number
  couponDiscount: number
  additionalDiscount: number
  additionalCost: number
  tax: number
  cardFee: number
  prepaymentCost: number
  prepaymentTip: number
  manualRefundAmount: number
  privateTourAdditionalCost: number

  reservationOptionsTotal: number
  requiredOptionTotal: number
  optionTotal: number
  notIncludedTotalUsd: number
  notIncludedBaseUsd: number
  notIncludedResidentFeesUsd: number

  depositAmount: number
  onlinePaymentAmount: number
  commissionAmount: number
  commissionPercent: number
  commissionBasePriceStored: number | null
  channelSettlementAmountStored: number | null
  balanceAmountStored: number | null
  totalPriceStored: number | null

  usesStoredChannelSettlement: boolean
  channelPricingFieldsUserEdited: boolean

  paymentRecords: PaymentRecordLike[]
  reservationExpensesTotal: number
  optionCancelRefundUsd: number
  tourExpensesTotal: number

  partnerReceivedAmount: number
}

/** PricingSection이 이미 계산해 둔 값 — 비교의 legacy 기준 */
export type LegacyPricingSnapshotFromUi = {
  customerPaymentGross: number
  customerPaymentNet: number
  onSiteBalance: number
  channelPaymentNet: number
  channelSettlement: number
  companyTotalRevenue: number
  operatingProfit: number
}

export type PricingComparisonRow = {
  key: keyof LegacyPricingSnapshotFromUi
  labelKo: string
  labelEn: string
  legacy: number
  next: number
  delta: number
  match: boolean
}

export type PricingComparisonResult = {
  profile: PricingProfileId
  allMatch: boolean
  mismatchCount: number
  rows: PricingComparisonRow[]
  legacy: LegacyPricingSnapshotFromUi
  next: ReservationPricingResult
}
