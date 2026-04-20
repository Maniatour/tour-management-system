from pathlib import Path

p = Path(r"src/app/[locale]/admin/reservations/page.tsx")
text = p.read_text(encoding="utf-8")

old_import = """import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import CustomerForm from '@/components/CustomerForm'"""

new_import = """import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import {
  computeCustomerPaymentTotalLineFormula,
  effectiveProductPriceTotalForBalance,
} from '@/utils/reservationPricingBalance'
import CustomerForm from '@/components/CustomerForm'"""

if old_import not in text:
    raise SystemExit("import block not found")

old_fn = """  // 가격 계산식 생성 - 예약 상세/가격 정보 모달과 동일한 공식
  // (판매가+불포함)×인원 = 상품가격합계 - 할인/추가비용 = 고객 총 결제 금액 - 채널 수수료 $ = 총매출 (Balance $x)
  const generatePriceCalculation = useCallback((reservation: any, pricing: any): string => {
    if (!pricing) return ''
    const toN = (v: number | undefined): number => (v == null || v === undefined ? 0 : Number(v) || 0)
    const productPriceTotal = toN(pricing.product_price_total)
    const couponDiscount = toN(pricing.coupon_discount)
    const additionalDiscount = toN(pricing.additional_discount)
    const additionalCost = toN(pricing.additional_cost)
    const commissionAmount = toN(pricing.commission_amount)
    const optionTotal = toN(pricing.option_total)
    const notIncludedPrice = toN(pricing.not_included_price)
    const totalPeople = Math.max(1, (reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0))
    // product_price_total(상품 가격 합계)에는 이미 (판매가+불포함)×인원이 포함됨 → 불포함 중복 가산 금지
    const adultPrice = toN(pricing.adult_product_price)
    const childPrice = toN(pricing.child_product_price)
    const infantPrice = toN(pricing.infant_product_price)
    let subtotal = productPriceTotal
    if (subtotal <= 0 && adultPrice > 0) {
      subtotal = adultPrice * (reservation.adults || 0) + childPrice * (reservation.child || 0) + infantPrice * (reservation.infant || 0)
    }
    if (subtotal <= 0) return ''
    // 고객 총 결제 금액 = 상품가격합계 - 할인 + 옵션 + 추가비용 (choices_total 제외 — option_total 과 이중 방지, 불포함은 상품가격합계에 포함)
    const customerTotalPayment = subtotal - couponDiscount - additionalDiscount + optionTotal + additionalCost
    const totalRevenue = Math.max(0, customerTotalPayment - commissionAmount)
    const currency = pricing.currency || 'USD'
    const sym = currency === 'KRW' ? '₩' : '$'
    // 표시: (판매가+불포함)=단가 × 인원 = 상품가격합계 또는 $945 × 3 = $945
    const unitPrice = adultPrice + notIncludedPrice
    let s: string
    if (notIncludedPrice > 0 && adultPrice > 0 && totalPeople > 0) {
      s = `(${sym}${adultPrice.toFixed(0)} + ${sym}${notIncludedPrice.toFixed(0)}) = ${sym}${unitPrice.toFixed(2)} × ${totalPeople} = ${sym}${subtotal.toFixed(2)}`
    } else {
      s = `${sym}${subtotal.toFixed(2)} × ${totalPeople} = ${sym}${subtotal.toFixed(2)}`
    }
    if (couponDiscount > 0 || additionalDiscount > 0) {
      s += ` - ${sym}${(couponDiscount + additionalDiscount).toFixed(2)} = ${sym}${customerTotalPayment.toFixed(2)}`
    }
    if (commissionAmount > 0) {
      s += ` - ${sym}${commissionAmount.toFixed(2)} = ${sym}${totalRevenue.toFixed(2)}`
    }
    return s
  }, [])"""

new_fn = """  // 가격 계산식 생성 — reservationPricingBalance.computeCustomerPaymentTotalLineFormula 와 동일
  // (필수옵션 + 선택옵션·예약 옵션 합계 = required_option_total + option_total, choices_total 제외)
  const generatePriceCalculation = useCallback((reservation: any, pricing: any): string => {
    if (!pricing) return ''
    const toN = (v: number | undefined): number => (v == null || v === undefined ? 0 : Number(v) || 0)
    const productPriceTotal = toN(pricing.product_price_total)
    const couponDiscount = toN(pricing.coupon_discount)
    const additionalDiscount = toN(pricing.additional_discount)
    const additionalCost = toN(pricing.additional_cost)
    const commissionAmount = toN(pricing.commission_amount)
    const optionTotal = toN(pricing.option_total)
    const requiredOptionTotal = toN(pricing.required_option_total)
    const optionsSubtotal = requiredOptionTotal + optionTotal
    const notIncludedPrice = toN(pricing.not_included_price)
    const totalPeople = Math.max(1, (reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0))
    const party = { adults: reservation.adults ?? 0, child: reservation.child ?? 0, infant: reservation.infant ?? 0 }
    const tax = toN(pricing.tax)
    const cardFee = toN(pricing.card_fee)
    const prepaymentCost = toN(pricing.prepayment_cost)
    const prepaymentTip = toN(pricing.prepayment_tip)
    const privateTourAdditional = toN(pricing.private_tour_additional_cost)
    const extrasSum =
      additionalCost + tax + cardFee + prepaymentCost + prepaymentTip + privateTourAdditional
    // product_price_total(상품 가격 합계)에는 이미 (판매가+불포함)×인원이 포함됨 → 불포함 중복 가산 금지
    const adultPrice = toN(pricing.adult_product_price)
    const childPrice = toN(pricing.child_product_price)
    const infantPrice = toN(pricing.infant_product_price)
    let subtotal = productPriceTotal
    if (subtotal <= 0 && adultPrice > 0) {
      subtotal = adultPrice * (reservation.adults || 0) + childPrice * (reservation.child || 0) + infantPrice * (reservation.infant || 0)
    }
    if (subtotal <= 0) return ''
    const gross = computeCustomerPaymentTotalLineFormula(pricing, party)
    const productSumForLine = effectiveProductPriceTotalForBalance(pricing, party)
    const totalRevenue = Math.max(0, gross - commissionAmount)
    const currency = pricing.currency || 'USD'
    const sym = currency === 'KRW' ? '₩' : '$'
    // 표시: (판매가+불포함)=단가 × 인원 = 상품가격합계 또는 $945 × 3 = $945
    const unitPrice = adultPrice + notIncludedPrice
    let s: string
    if (notIncludedPrice > 0 && adultPrice > 0 && totalPeople > 0) {
      s = `(${sym}${adultPrice.toFixed(0)} + ${sym}${notIncludedPrice.toFixed(0)}) = ${sym}${unitPrice.toFixed(2)} × ${totalPeople} = ${sym}${subtotal.toFixed(2)}`
    } else {
      s = `${sym}${subtotal.toFixed(2)} × ${totalPeople} = ${sym}${subtotal.toFixed(2)}`
    }
    const disc = couponDiscount + additionalDiscount
    const hasAdjustmentsAfterProduct =
      disc > 0.005 || optionsSubtotal > 0.005 || extrasSum > 0.005
    if (hasAdjustmentsAfterProduct) {
      if (disc > 0.005) {
        s += ` - ${sym}${disc.toFixed(2)}`
      }
      if (optionsSubtotal > 0.005) {
        s += ` + ${sym}${optionsSubtotal.toFixed(2)}`
      }
      if (extrasSum > 0.005) {
        s += ` + ${sym}${extrasSum.toFixed(2)}`
      }
      s += ` = ${sym}${gross.toFixed(2)}`
    } else if (Math.abs(productSumForLine - gross) > 0.02) {
      s += ` (${sym}${productSumForLine.toFixed(2)} 상품합) = ${sym}${gross.toFixed(2)}`
    }
    if (commissionAmount > 0) {
      s += ` - ${sym}${commissionAmount.toFixed(2)} = ${sym}${totalRevenue.toFixed(2)}`
    }
    return s
  }, [])"""

text = text.replace(old_import, new_import, 1)
if old_fn not in text:
    raise SystemExit("generatePriceCalculation block not found")
text = text.replace(old_fn, new_fn, 1)
p.write_text(text, encoding="utf-8")
print("patched ok")
