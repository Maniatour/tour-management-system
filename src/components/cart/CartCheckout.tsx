'use client'

import React, { useState, useEffect } from 'react'
import { X, ShoppingCart, CreditCard, Ticket, Lock, Loader2 } from 'lucide-react'
import { useCart } from './CartProvider'
import { useLocale } from 'next-intl'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'

interface CartCheckoutProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// Stripe Elements를 사용하는 결제 폼
function CheckoutPaymentForm({
  totalAmount,
  discountAmount,
  finalAmount,
  customerInfo,
  onPaymentComplete,
  translate
}: {
  totalAmount: number
  discountAmount: number
  finalAmount: number
  customerInfo: { name: string; email: string }
  onPaymentComplete: (result: { success: boolean; transactionId?: string | null }) => Promise<void>
  translate: (ko: string, en: string) => string
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
      // Payment Intent 생성
      const response = await fetch('/api/payment/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: finalAmount,
          currency: 'usd',
          reservationId: `cart_checkout_${Date.now()}`,
          customerInfo: {
            name: customerInfo.name,
            email: customerInfo.email
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || translate('결제 요청 생성에 실패했습니다.', 'Failed to create payment request.'))
      }

      const { clientSecret } = await response.json()

      if (!clientSecret) {
        throw new Error(
          translate(
            '결제 시크릿을 받지 못했습니다. 서버 설정을 확인해주세요.',
            'Failed to receive payment secret. Please check server configuration.'
          )
        )
      }

      // Stripe Elements로 결제 확인
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
        await onPaymentComplete({
          success: true,
          transactionId: paymentIntent.id
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
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start">
            <Lock className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-blue-800">
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
                ? 'bg-blue-600 text-white hover:bg-blue-700'
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

  // 결제 완료 처리
  const handlePaymentComplete = async (result: { success: boolean; transactionId?: string | null }) => {
    if (!result.success) {
      return
    }

    try {
      setLoading(true)

      // 각 장바구니 아이템에 대해 예약 생성
      const reservationIds: string[] = []
      const transactionId = result.transactionId

      for (const item of items) {
        const reservationId = `reservation_${Date.now()}_${Math.random().toString(36).substring(2)}`
        reservationIds.push(reservationId)

        // 예약 데이터 생성
        const reservationData = {
          id: reservationId,
          product_id: item.productId,
          customer_name: item.customerInfo.name,
          customer_email: item.customerInfo.email,
          customer_phone: item.customerInfo.phone,
          tour_date: item.tourDate,
          departure_time: item.departureTime || null,
          adults: item.participants.adults,
          children: item.participants.children,
          infants: item.participants.infants,
          total_people: item.participants.adults + item.participants.children + item.participants.infants,
          total_price: item.totalPrice,
          choices_total: 0,
          status: transactionId ? 'confirmed' : 'pending',
          notes: item.customerInfo.specialRequests || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        // 예약 생성
        const { error: reservationError } = await supabase
          .from('reservations')
          .insert(reservationData as never)

        if (reservationError) {
          console.error('예약 생성 오류:', reservationError)
          throw new Error(`예약 생성 오류: ${reservationError.message}`)
        }

        // 선택된 옵션 저장
        // selectedOptions는 choice_id를 키로, option_id를 값으로 가지는 객체
        // 실제 저장 로직은 간소화 (필요시 확장 가능)
        if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) {
          // reservation_choices 저장 (필수 선택)
          const choicesToInsert = Object.entries(item.selectedOptions).map(([choiceId, optionId]) => {
            const totalParticipants = item.participants.adults + item.participants.children + item.participants.infants
            return {
              reservation_id: reservationId,
              choice_id: choiceId,
              option_id: optionId as string,
              quantity: totalParticipants,
              total_price: 0 // 가격은 나중에 계산 가능
            }
          })

          if (choicesToInsert.length > 0) {
            const { error: choicesError } = await supabase
              .from('reservation_choices')
              .insert(choicesToInsert as never)

            if (choicesError) {
              console.error('예약 선택사항 저장 오류:', choicesError)
            }
          }
        }
      }

      // 결제 기록 생성 (전체 결제)
      if (transactionId) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            await fetch('/api/payment-records', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                reservation_id: reservationIds[0], // 첫 번째 예약 ID 사용
                payment_status: 'confirmed',
                amount: finalAmount,
                payment_method: paymentMethod,
                note: transactionId ? `Cart Checkout - Transaction ID: ${transactionId}, Coupon: ${appliedCoupon?.code || 'None'}` : null
              })
            })
          }
        } catch (error) {
          console.error('결제 기록 생성 오류:', error)
        }
      }

      // 이메일 발송 (각 예약에 대해)
      if (transactionId && customerInfo.email) {
        try {
          // 모든 예약에 대해 이메일 발송
          const emailPromises = reservationIds.map(async (reservationId) => {
            return fetch('/api/send-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                reservationId: reservationId,
                email: customerInfo.email,
                type: 'both', // 영수증과 투어 바우처 모두 발송
                locale: isEnglish ? 'en' : 'ko'
              })
            }).catch(error => {
              console.error(`예약 ${reservationId} 이메일 발송 오류 (무시):`, error)
              return null
            })
          })

          await Promise.all(emailPromises)
        } catch (error) {
          console.error('이메일 발송 오류 (무시):', error)
          // 이메일 발송 실패해도 결제는 완료된 것으로 처리
        }
      }

      // 성공 메시지
      const emailMessage = customerInfo.email 
        ? (isEnglish 
          ? `Receipts and tour vouchers have been sent to ${customerInfo.email}. ` 
          : `영수증과 투어 바우처가 ${customerInfo.email}로 발송되었습니다. `)
        : ''
      
      alert(isEnglish 
        ? `Payment successful! ${reservationIds.length} reservation(s) have been confirmed. ${emailMessage}Transaction ID: ${transactionId}` 
        : `결제가 완료되었습니다! ${reservationIds.length}개의 예약이 확정되었습니다. ${emailMessage}거래 ID: ${transactionId}`)

      // 장바구니 비우기
      clearCart()
      onSuccess()
      onClose()

    } catch (error) {
      console.error('예약 생성 오류:', error)
      alert(isEnglish 
        ? `Failed to create reservations: ${error instanceof Error ? error.message : 'Unknown error'}` 
        : `예약 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
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
              {items.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {isEnglish ? item.productNameEn || item.productName || item.productNameKo : item.productNameKo || item.productName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(item.tourDate).toLocaleDateString(isEnglish ? 'en-US' : 'ko-KR')}
                        {item.departureTime && ` • ${item.departureTime}`}
                      </div>
                      {/* 선택된 초이스 표시 */}
                      {item.selectedChoices && item.selectedChoices.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="text-xs font-medium text-gray-700 mb-1">
                            {translate('선택 사항', 'Selected Options')}
                          </div>
                          <div className="space-y-1">
                            {item.selectedChoices.map((choice, idx) => (
                              <div key={idx} className="text-xs text-gray-600">
                                <span className="font-medium">
                                  {isEnglish 
                                    ? choice.choiceNameEn || choice.choiceNameKo || choice.choiceName 
                                    : choice.choiceNameKo || choice.choiceName}
                                </span>
                                <span className="mx-1">:</span>
                                <span>
                                  {isEnglish 
                                    ? choice.optionNameEn || choice.optionNameKo || choice.optionName 
                                    : choice.optionNameKo || choice.optionName}
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      : 'bg-blue-600 text-white hover:bg-blue-700'
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
                <span className="text-blue-600">${finalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 결제 방법 선택 */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">{translate('결제 방법', 'Payment Method')}</h4>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                onPaymentComplete={handlePaymentComplete}
                translate={translate}
              />
            </Elements>
          )}

          {/* 은행 이체 안내 */}
          {paymentMethod === 'bank_transfer' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm text-blue-800">
                  {translate('은행 이체 정보는 예약 확정 후 별도로 안내드립니다.', 'Bank transfer information will be sent separately after your reservation is confirmed.')}
                </span>
              </div>
              <button
                onClick={async () => {
                  await handlePaymentComplete({ success: true, transactionId: null })
                }}
                disabled={loading}
                className="w-full mt-4 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
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

