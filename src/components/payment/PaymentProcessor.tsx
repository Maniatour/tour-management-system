'use client'

import React, { useState } from 'react'
import { CreditCard, CheckCircle, AlertCircle, Loader, Shield, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PaymentData {
  method: 'card' | 'bank_transfer' | 'paypal' | 'cash'
  amount: number
  currency: 'USD' | 'KRW'
  customerInfo: {
    name: string
    email: string
    phone: string
  }
  billingAddress?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
}

interface PaymentResult {
  success: boolean
  transactionId?: string
  error?: string
  reservationId?: string
}

interface PaymentProcessorProps {
  paymentData: PaymentData
  cartItems: any[]
  onSuccess: (result: PaymentResult) => void
  onError: (error: string) => void
  onCancel: () => void
}

export default function PaymentProcessor({
  paymentData,
  cartItems,
  onSuccess,
  onError,
  onCancel
}: PaymentProcessorProps) {
  const [step, setStep] = useState<'method' | 'processing' | 'result'>('method')
  const [selectedMethod, setSelectedMethod] = useState<string>(paymentData.method)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  })

  const paymentMethods = [
    {
      id: 'card',
      name: '신용카드',
      icon: CreditCard,
      description: 'Visa, MasterCard, American Express',
      available: true
    },
    {
      id: 'bank_transfer',
      name: '은행 이체',
      icon: Shield,
      description: '국내 계좌이체',
      available: true
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: CreditCard,
      description: 'PayPal 계정으로 결제',
      available: false // 향후 구현
    },
    {
      id: 'cash',
      name: '현금 결제',
      icon: CreditCard,
      description: '현장에서 현금으로 결제',
      available: true
    }
  ]

  const handlePayment = async () => {
    setProcessing(true)
    setStep('processing')

    try {
      // 예약 생성
      const reservationResult = await createReservations(cartItems, paymentData.customerInfo)
      
      if (!reservationResult.success) {
        throw new Error(reservationResult.error || '예약 생성에 실패했습니다.')
      }

      // 결제 처리
      const paymentResult = await processPayment(selectedMethod, paymentData, cardDetails)
      
      if (!paymentResult.success) {
        throw new Error(paymentResult.error || '결제 처리에 실패했습니다.')
      }

      // 결제 기록 생성
      await createPaymentRecord({
        reservationId: reservationResult.reservationId!,
        amount: paymentData.amount,
        paymentMethod: selectedMethod,
        transactionId: paymentResult.transactionId,
        status: 'confirmed'
      })

      const finalResult: PaymentResult = {
        success: true,
        transactionId: paymentResult.transactionId,
        reservationId: reservationResult.reservationId
      }

      setResult(finalResult)
      setStep('result')
      onSuccess(finalResult)

    } catch (error) {
      console.error('결제 처리 오류:', error)
      const errorResult: PaymentResult = {
        success: false,
        error: error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다.'
      }
      setResult(errorResult)
      setStep('result')
      onError(errorResult.error!)
    } finally {
      setProcessing(false)
    }
  }

  const createReservations = async (items: any[], customerInfo: any) => {
    try {
      const reservations = []
      
      for (const item of items) {
        const reservationData = {
          id: `reservation_${Date.now()}_${Math.random().toString(36).substring(2)}`,
          product_id: item.productId,
          customer_name: customerInfo.name,
          customer_email: customerInfo.email,
          customer_phone: customerInfo.phone,
          tour_date: item.tourDate,
          departure_time: item.departureTime,
          adults: item.participants.adults,
          children: item.participants.children,
          infants: item.participants.infants,
          total_price: item.totalPrice,
          status: 'confirmed',
          special_requests: customerInfo.specialRequests || '',
          nationality: customerInfo.nationality || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('reservations')
          .insert(reservationData)
          .select('id')
          .single()

        if (error) {
          console.error('예약 생성 오류:', error)
          return { success: false, error: error.message }
        }

        reservations.push(data.id)
      }

      return { 
        success: true, 
        reservationId: reservations[0], // 첫 번째 예약 ID 반환
        reservationIds: reservations 
      }
    } catch (error) {
      console.error('예약 생성 오류:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '예약 생성 중 오류가 발생했습니다.' 
      }
    }
  }

  const processPayment = async (method: string, paymentData: PaymentData, cardDetails?: any) => {
    // 실제 결제 처리 로직 (결제 게이트웨이 연동)
    // 여기서는 시뮬레이션으로 처리
    
    return new Promise<PaymentResult>((resolve) => {
      setTimeout(() => {
        if (method === 'card' && (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvv)) {
          resolve({
            success: false,
            error: '카드 정보를 모두 입력해주세요.'
          })
          return
        }

        // 결제 성공 시뮬레이션
        resolve({
          success: true,
          transactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(2)}`
        })
      }, 2000)
    })
  }

  const createPaymentRecord = async (paymentRecord: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch('/api/payment-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(paymentRecord)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '결제 기록 생성에 실패했습니다.')
      }

      return await response.json()
    } catch (error) {
      console.error('결제 기록 생성 오류:', error)
      throw error
    }
  }

  const renderPaymentMethod = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">결제 방법 선택</h3>
        <div className="space-y-3">
          {paymentMethods.map((method) => {
            const Icon = method.icon
            return (
              <div
                key={method.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedMethod === method.id
                    ? 'border-blue-500 bg-blue-50'
                    : method.available
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                }`}
                onClick={() => method.available && setSelectedMethod(method.id)}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="h-6 w-6 text-gray-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{method.name}</div>
                    <div className="text-sm text-gray-600">{method.description}</div>
                  </div>
                  {!method.available && (
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                      준비중
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 카드 정보 입력 */}
      {selectedMethod === 'card' && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-4">카드 정보</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카드 번호</label>
              <input
                type="text"
                value={cardDetails.number}
                onChange={(e) => setCardDetails(prev => ({ ...prev, number: e.target.value }))}
                placeholder="1234 5678 9012 3456"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">만료일</label>
                <input
                  type="text"
                  value={cardDetails.expiry}
                  onChange={(e) => setCardDetails(prev => ({ ...prev, expiry: e.target.value }))}
                  placeholder="MM/YY"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                <input
                  type="text"
                  value={cardDetails.cvv}
                  onChange={(e) => setCardDetails(prev => ({ ...prev, cvv: e.target.value }))}
                  placeholder="123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카드 소유자명</label>
              <input
                type="text"
                value={cardDetails.name}
                onChange={(e) => setCardDetails(prev => ({ ...prev, name: e.target.value }))}
                placeholder="홍길동"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* 결제 정보 요약 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">결제 정보</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">총 금액</span>
            <span className="font-medium">${paymentData.amount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">통화</span>
            <span className="font-medium">{paymentData.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">결제 방법</span>
            <span className="font-medium">
              {paymentMethods.find(m => m.id === selectedMethod)?.name}
            </span>
          </div>
        </div>
      </div>

      {/* 보안 정보 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <Lock className="h-5 w-5 text-blue-600 mr-2" />
          <span className="text-sm text-blue-800">
            모든 결제 정보는 SSL로 암호화되어 안전하게 전송됩니다.
          </span>
        </div>
      </div>
    </div>
  )

  const renderProcessing = () => (
    <div className="text-center py-12">
      <Loader className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-spin" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">결제 처리 중...</h3>
      <p className="text-gray-600">잠시만 기다려주세요. 결제가 진행되고 있습니다.</p>
    </div>
  )

  const renderResult = () => {
    if (!result) return null

    if (result.success) {
      return (
        <div className="text-center py-12">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">결제 완료!</h3>
          <p className="text-gray-600 mb-4">예약이 성공적으로 완료되었습니다.</p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">거래 ID:</span>
                <span className="font-medium">{result.transactionId}</span>
              </div>
              {result.reservationId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">예약 ID:</span>
                  <span className="font-medium">{result.reservationId}</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500">
            예약 확인 이메일이 {paymentData.customerInfo.email}로 발송되었습니다.
          </p>
        </div>
      )
    } else {
      return (
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">결제 실패</h3>
          <p className="text-gray-600 mb-4">{result.error}</p>
          <button
            onClick={() => {
              setStep('method')
              setResult(null)
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      )
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {step === 'method' && renderPaymentMethod()}
      {step === 'processing' && renderProcessing()}
      {step === 'result' && renderResult()}

      {step === 'method' && (
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handlePayment}
            disabled={processing}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            ${paymentData.amount} 결제하기
          </button>
        </div>
      )}
    </div>
  )
}
