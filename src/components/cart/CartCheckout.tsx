'use client'

import React, { useState, useEffect } from 'react'
import { X, CreditCard, Ticket, Lock, Loader2 } from 'lucide-react'
import { useCart } from './CartProvider'
import { useLocale } from 'next-intl'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getAppOrigin } from '@/lib/appOrigin'

interface CartCheckoutProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type CartPaymentResult = {
  success: boolean
  transactionId?: string | null
  reservationIds?: string[]
  amountUsd?: number | null
}

// Stripe Elements를 사용하는 결제 폼
function CheckoutPaymentForm({
  finalAmount,
  customerInfo,
  checkoutPayload,
  onPaymentComplete,
  translate,
  locale,
}: {
  totalAmount: number
  discountAmount: number
  finalAmount: number
  customerInfo: { name: string; email: string; phone: string }
  checkoutPayload: Record<string, unknown>
  onPaymentComplete: (result: CartPaymentResult) => Promise<void>
  translate: (ko: string, en: string) => string
  locale: 'ko' | 'en'
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [cardError, setCardError] = useState<string>('')
  const [processing, setProcessing] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setCardError('')

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setCardError(translate('카드 정보를 불러올 수 없습니다.', 'Unable to load card information.'))
      setProcessing(false)
      return
    }

    try {
      const response = await fetch('/api/booking/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutPayload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || translate('결제 요청 생성에 실패했습니다.', 'Failed to create payment request.'))
      }

      const checkoutResult = await response.json()
      const { clientSecret, reservationId, reservationIds, paymentIntentId, amountUsd } = checkoutResult

      if (!clientSecret || !reservationId) {
        throw new Error(
          translate(
            '결제 시크릿을 받지 못했습니다. 서버 설정을 확인해주세요.',
            'Failed to receive payment secret. Please check server configuration.'
          )
        )
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: customerInfo.name,
            email: customerInfo.email,
          },
        },
      })

      if (error) {
        setCardError(error.message || translate('결제에 실패했습니다.', 'Payment failed.'))
        setProcessing(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        const confirmRes = await fetch('/api/booking/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            paymentIntentId: paymentIntent.id || paymentIntentId,
            locale,
            origin: getAppOrigin(),
          }),
        })
        if (!confirmRes.ok) {
          const errBody = await confirmRes.json().catch(() => ({}))
          throw new Error(
            errBody.error ||
              translate(
                '결제는 완료되었으나 예약 확정에 실패했습니다. 예약 조회로 확인해 주세요.',
                'Payment succeeded but reservation confirmation failed. Please check your reservation.'
              )
          )
        }

        await onPaymentComplete({
          success: true,
          transactionId: paymentIntent.id,
          reservationIds: Array.isArray(reservationIds) ? reservationIds : [reservationId],
          amountUsd: typeof amountUsd === 'number' ? amountUsd : null,
        })
      } else {
        throw new Error(translate('결제가 완료되지 않았습니다.', 'Payment was not completed.'))
      }
    } catch (error) {
      console.error('Stripe 결제 처리 오류:', error)
      setCardError(error instanceof Error ? error.message : translate('결제 처리 중 오류가 발생했습니다.', 'An error occurred during payment processing.'))
      setProcessing(false)
    }
  }

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <CreditCard className="h-5 w-5 mr-2 text-gray-600" />
          {translate('카드 정보', 'Card Information')}
        </h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translate('카드 정보', 'Card Details')} *
            </label>
            <div className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <CardElement options={cardElementOptions} />
            </div>
            {cardError && (
              <p className="text-xs text-red-500 mt-1">{cardError}</p>
            )}
          </div>
        </div>
        <div className="mt-4 bg-muted/50 border border-border rounded-lg p-3">
          <div className="flex items-start">
            <Lock className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-primary">
              {translate('카드 정보는 Stripe를 통해 안전하게 처리됩니다. 서버에 저장되지 않습니다.', 'Card information is securely processed through Stripe. It is not stored on our servers.')}
            </span>
          </div>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={!stripe || processing}
            className={`w-full flex items-center justify-center px-6 py-2 rounded-lg font-medium transition-colors ${
              stripe && !processing
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {translate('처리 중...', 'Processing...')}
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                {translate('결제하기', 'Pay Now')} ${finalAmount.toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function CartCheckout({ isOpen, onClose, onSuccess }: CartCheckoutProps) {
  const { items, getTotalPrice, clearCart } = useCart()
  const locale = useLocale()
  const isEnglish = locale === 'en'
  const translate = (ko: string, en: string) => (isEnglish ? en : ko)

  const [paymentMethod, setPaymentMethod] = useState<string>('card')
  const [couponCode, setCouponCode] = useState<string>('')
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [couponError, setCouponError] = useState<string>('')
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null)
  const [loading, setLoading] = useState(false)

  // Stripe 초기화
  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (publishableKey) {
      // Stripe 로딩 시 에러 처리 및 옵션 추가
      const stripePromiseValue = loadStripe(publishableKey, {
        // Stripe.js 로딩 최적화 옵션
        locale: isEnglish ? 'en' : 'ko',
      })
      
      // Promise에 에러 핸들러 추가
      stripePromiseValue.catch((error) => {
        console.error('Stripe 로딩 오류:', error)
        // 에러가 발생해도 계속 진행 (사용자에게 알림)
      })
      
      setStripePromise(stripePromiseValue)
    }
  }, [isEnglish])

  // 장바구니 아이템 확인
  useEffect(() => {
    if (isOpen) {
      console.log('CartCheckout 열림 - 장바구니 상태:', {
        itemsCount: items.length,
        items: items,
        totalPrice: getTotalPrice()
      })
      
      if (items.length === 0) {
        console.warn('장바구니가 비어있습니다.')
        // 장바구니가 비어있으면 닫기
        setTimeout(() => {
          onClose()
        }, 100)
      }
    }
  }, [isOpen, items, getTotalPrice, onClose])

  const totalPrice = getTotalPrice()
  const finalAmount = Math.max(0, totalPrice - discountAmount)

  // 장바구니가 비어있으면 아무것도 렌더링하지 않음
  if (!isOpen || items.length === 0) {
    return null
  }

  // 첫 번째 아이템의 고객 정보 사용 (모든 아이템이 같은 고객 정보를 가진다고 가정)
  const customerInfo = items.length > 0 ? items[0].customerInfo : { name: '', email: '', phone: '', nationality: '', specialRequests: '' }

  // 쿠폰 검증
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError(translate('쿠폰 코드를 입력해주세요.', 'Please enter a coupon code.'))
      return
    }

    // 장바구니 확인
    if (items.length === 0) {
      setCouponError(translate('장바구니가 비어있습니다.', 'Cart is empty.'))
      return
    }

    if (totalPrice <= 0) {
      setCouponError(translate('총 결제 금액이 0입니다. 쿠폰을 적용할 수 없습니다.', 'Total amount is 0. Cannot apply coupon.'))
      return
    }

    setValidatingCoupon(true)
    setCouponError('')

    try {
      const productIds = items.map(item => item.productId).filter(id => id) // null/undefined 제거
      const requestBody = {
        couponCode: couponCode.trim(),
        totalAmount: totalPrice,
        productIds
      }

      console.log('쿠폰 검증 요청 전송:', requestBody)
      console.log('장바구니 아이템:', items)
      console.log('총 금액:', totalPrice)

      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('쿠폰 검증 응답 상태:', response.status)

      if (!response.ok) {
        // 400 오류인 경우 응답 본문 읽기
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('쿠폰 검증 API 오류:', errorData)
        setCouponError(errorData.error || translate('쿠폰 검증 중 오류가 발생했습니다.', 'An error occurred while validating the coupon.'))
        return
      }

      const data = await response.json()
      console.log('쿠폰 검증 응답 데이터:', data)

      if (data.valid) {
        setAppliedCoupon(data.coupon)
        setDiscountAmount(data.discountAmount)
        setCouponError('')
      } else {
        setAppliedCoupon(null)
        setDiscountAmount(0)
        setCouponError(data.error || translate('유효하지 않은 쿠폰 코드입니다.', 'Invalid coupon code.'))
      }
    } catch (error) {
      console.error('쿠폰 검증 오류:', error)
      setCouponError(translate('쿠폰 검증 중 오류가 발생했습니다.', 'An error occurred while validating the coupon.'))
    } finally {
      setValidatingCoupon(false)
    }
  }

  // 쿠폰 제거
  const handleRemoveCoupon = () => {
    setCouponCode('')
    setAppliedCoupon(null)
    setDiscountAmount(0)
    setCouponError('')
  }

  const buildCartCheckoutPayload = () => ({
    customerInfo: {
      name: customerInfo.name,
      email: customerInfo.email,
      phone: customerInfo.phone,
      specialRequests: customerInfo.specialRequests,
    },
    couponCode: appliedCoupon?.code || null,
    locale: isEnglish ? 'en' : 'ko',
    items: items.map((item) => ({
      productId: item.productId,
      tourDate: item.tourDate,
      departureTime: item.departureTime || null,
      adults: item.participants.adults,
      children: item.participants.children,
      infants: item.participants.infants,
      selectedOptions: item.selectedOptions || {},
    })),
  })

  // 카드: 서버에서 이미 예약·결제·이메일 처리됨 → confirmation 페이지
  const handlePaymentComplete = async (result: CartPaymentResult) => {
    if (!result.success) return

    try {
      setLoading(true)
      const reservationIds = result.reservationIds || []
      const primaryId = reservationIds[0] || ''

      clearCart()
      onSuccess()
      onClose()

      const params = new URLSearchParams({
        status: 'success',
        id: primaryId,
        email: customerInfo.email || '',
      })
      if (reservationIds.length > 1) {
        params.set('ids', reservationIds.join(','))
      }
      window.location.href = `/${isEnglish ? 'en' : 'ko'}/booking/confirmation?${params.toString()}`
    } finally {
      setLoading(false)
    }
  }

  // 은행 이체: 아이템별 inquiry 생성
  const handleBankTransferComplete = async () => {
    try {
      setLoading(true)
      const reservationIds: string[] = []

      for (const item of items) {
        const response = await fetch('/api/booking/create-inquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerInfo: {
              name: item.customerInfo.name,
              email: item.customerInfo.email,
              phone: item.customerInfo.phone,
              specialRequests: item.customerInfo.specialRequests,
            },
            productId: item.productId,
            tourDate: item.tourDate,
            departureTime: item.departureTime || null,
            adults: item.participants.adults,
            children: item.participants.children,
            infants: item.participants.infants,
            selectedOptions: item.selectedOptions || {},
          }),
        })
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(errBody.error || 'Inquiry failed')
        }
        const data = await response.json()
        if (data.reservationId) reservationIds.push(data.reservationId)
      }

      clearCart()
      onSuccess()
      onClose()

      const params = new URLSearchParams({
        status: 'success',
        id: reservationIds[0] || '',
        email: customerInfo.email || '',
      })
      if (reservationIds.length > 1) {
        params.set('ids', reservationIds.join(','))
      }
      window.location.href = `/${isEnglish ? 'en' : 'ko'}/booking/confirmation?${params.toString()}`
    } catch (error) {
      console.error('예약 생성 오류:', error)
      alert(
        isEnglish
          ? `Failed to create reservations: ${error instanceof Error ? error.message : 'Unknown error'}`
          : `예약 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">{translate('결제하기', 'Checkout')}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6 overflow-y-auto max-h-[70vh]">
          {/* 주문 요약 */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-4">{translate('주문 요약', 'Order Summary')}</h3>
            <div className="space-y-4 text-sm">
              {items.map((item) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {isEnglish ? item.productNameEn || item.productName || item.productNameKo : item.productNameKo || item.productName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {(() => {
                          // 날짜 문자열을 직접 파싱하여 시간대 문제 방지
                          const [year, month, day] = item.tourDate.split('-').map(Number)
                          const date = new Date(year, month - 1, day)
                          return date.toLocaleDateString(isEnglish ? 'en-US' : 'ko-KR')
                        })()}
                        {item.departureTime && ` • ${item.departureTime}`}
                      </div>
                      {/* 선택된 초이스 표시 */}
                      {item.selectedChoices && item.selectedChoices.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="text-xs font-medium text-gray-700 mb-1">
                            {translate('선택 초이스', 'Selected Choices')}
                          </div>
                          <div className="space-y-1">
                            {item.selectedChoices.map((choice, idx) => (
                              <div key={idx} className="text-xs text-gray-600">
                                <span className="font-medium">
                                  {isEnglish 
                                    ? choice.choiceNameEn || choice.choiceName || choice.choiceNameKo 
                                    : choice.choiceNameKo || choice.choiceName || choice.choiceNameEn}
                                </span>
                                <span className="mx-1">:</span>
                                <span>
                                  {isEnglish 
                                    ? choice.optionNameEn || choice.optionName || choice.optionNameKo 
                                    : choice.optionNameKo || choice.optionName || choice.optionNameEn}
                                </span>
                                {choice.optionPrice !== null && choice.optionPrice > 0 && (
                                  <span className="ml-1 text-green-600">
                                    (+${choice.optionPrice})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-medium text-gray-900">${item.totalPrice.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 쿠폰 적용 */}
          <div className="mb-6 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <Ticket className="h-5 w-5 mr-2 text-gray-600" />
              {translate('쿠폰', 'Coupon')}
            </h4>
            {!appliedCoupon ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase())
                    setCouponError('')
                  }}
                  placeholder={translate('쿠폰 코드 입력', 'Enter coupon code')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyCoupon()
                    }
                  }}
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={validatingCoupon || !couponCode.trim()}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    validatingCoupon || !couponCode.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {validatingCoupon ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    translate('적용', 'Apply')
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-green-800">{appliedCoupon.code}</div>
                    <div className="text-sm text-green-600">{appliedCoupon.description}</div>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-green-600 hover:text-green-800 text-sm"
                  >
                    {translate('제거', 'Remove')}
                  </button>
                </div>
              </div>
            )}
            {couponError && (
              <p className="text-xs text-red-500 mt-2">{couponError}</p>
            )}
          </div>

          {/* 가격 요약 */}
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{translate('소계', 'Subtotal')}</span>
                <span className="text-gray-900">${totalPrice.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{translate('할인', 'Discount')}</span>
                  <span className="text-green-600">-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span className="text-gray-900">{translate('총 결제 금액', 'Total')}</span>
                <span className="text-primary">${finalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 결제 방법 선택 */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">{translate('결제 방법', 'Payment Method')}</h4>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="card">{translate('신용카드', 'Credit Card')}</option>
              <option value="bank_transfer">{translate('은행 이체', 'Bank Transfer')}</option>
            </select>
          </div>

          {/* 결제 폼 */}
          {paymentMethod === 'card' && stripePromise && (
            <Elements 
              stripe={stripePromise}
              options={{
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <CheckoutPaymentForm
                totalAmount={totalPrice}
                discountAmount={discountAmount}
                finalAmount={finalAmount}
                customerInfo={customerInfo}
                checkoutPayload={buildCartCheckoutPayload()}
                onPaymentComplete={handlePaymentComplete}
                translate={translate}
                locale={isEnglish ? 'en' : 'ko'}
              />
            </Elements>
          )}

          {/* 은행 이체 안내 */}
          {paymentMethod === 'bank_transfer' && (
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-primary mr-2" />
                <span className="text-sm text-primary">
                  {translate('은행 이체 정보는 예약 확정 후 별도로 안내드립니다.', 'Bank transfer information will be sent separately after your reservation is confirmed.')}
                </span>
              </div>
              <button
                onClick={async () => {
                  await handleBankTransferComplete()
                }}
                disabled={loading}
                className="w-full mt-4 bg-primary text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {translate('처리 중...', 'Processing...')}
                  </>
                ) : (
                  translate('예약 완료', 'Complete Reservation')
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

