'use client'

import React, { useState } from 'react'
import { Calendar, Users, MapPin, Clock, CreditCard, CheckCircle, AlertCircle, Search, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Reservation {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  tour_date: string
  departure_time: string | null
  adults: number
  children: number
  infants: number
  total_price: number
  special_requests: string | null
  nationality: string | null
  status: string
  created_at: string
  product: {
    id: string
    name: string
    name_ko: string | null
    customer_name_ko: string
    base_price: number
    duration: string | null
    max_participants: number | null
    departure_city: string | null
    arrival_city: string | null
    departure_country: string | null
    arrival_country: string | null
  }
  reservation_options: Array<{
    choice_id: string
    option_id: string
    choice: {
      choice_name: string
      choice_name_ko: string | null
      choice_type: string
    }
    option: {
      option_name: string
      option_name_ko: string | null
      option_price: number | null
    }
  }>
  payment_records: Array<{
    id: string
    payment_status: string
    amount: number
    payment_method: string
    submit_on: string
    confirmed_on: string | null
  }>
}

export default function ReservationCheckPage() {
  const [reservationId, setReservationId] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!reservationId || !customerEmail) {
      setError('예약 ID와 이메일을 모두 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reservations/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reservation_id: reservationId,
          customer_email: customerEmail
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '예약을 찾을 수 없습니다.')
      }

      setReservation(data.reservation)
    } catch (error) {
      console.error('예약 조회 오류:', error)
      setError(error instanceof Error ? error.message : '예약 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '확정'
      case 'pending':
        return '대기중'
      case 'cancelled':
        return '취소됨'
      case 'completed':
        return '완료'
      default:
        return status
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '확인됨'
      case 'pending':
        return '대기중'
      case 'rejected':
        return '거부됨'
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">예약 확인</h1>
              <p className="text-gray-600">예약 ID와 이메일로 예약 정보를 확인하세요</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 검색 폼 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">예약 정보 입력</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">예약 ID</label>
              <input
                type="text"
                value={reservationId}
                onChange={(e) => setReservationId(e.target.value)}
                placeholder="예약 ID를 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="예약 시 사용한 이메일을 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  검색 중...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  예약 확인
                </>
              )}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* 예약 정보 */}
        {reservation && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {/* 예약 헤더 */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{reservation.product.customer_name_ko}</h2>
                  <p className="text-blue-100">예약 ID: {reservation.id}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(reservation.status)}`}>
                    {getStatusLabel(reservation.status)}
                  </span>
                  <div className="text-white text-lg font-semibold mt-1">
                    ${reservation.total_price}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">투어 정보</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-blue-500 mr-3" />
                      <div>
                        <span className="text-sm text-gray-600">투어 날짜</span>
                        <p className="font-medium">
                          {new Date(reservation.tour_date).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </p>
                      </div>
                    </div>
                    {reservation.departure_time && (
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-green-500 mr-3" />
                        <div>
                          <span className="text-sm text-gray-600">출발 시간</span>
                          <p className="font-medium">{reservation.departure_time}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center">
                      <Users className="h-5 w-5 text-purple-500 mr-3" />
                      <div>
                        <span className="text-sm text-gray-600">참가자</span>
                        <p className="font-medium">
                          성인 {reservation.adults}명
                          {reservation.children > 0 && `, 아동 ${reservation.children}명`}
                          {reservation.infants > 0 && `, 유아 ${reservation.infants}명`}
                        </p>
                      </div>
                    </div>
                    {(reservation.product.departure_city || reservation.product.arrival_city) && (
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-red-500 mr-3" />
                        <div>
                          <span className="text-sm text-gray-600">경로</span>
                          <p className="font-medium">
                            {reservation.product.departure_city && reservation.product.arrival_city
                              ? `${reservation.product.departure_city} → ${reservation.product.arrival_city}`
                              : reservation.product.departure_city || reservation.product.arrival_city}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">고객 정보</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">이름</span>
                      <p className="font-medium">{reservation.customer_name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">이메일</span>
                      <p className="font-medium">{reservation.customer_email}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">전화번호</span>
                      <p className="font-medium">{reservation.customer_phone}</p>
                    </div>
                    {reservation.nationality && (
                      <div>
                        <span className="text-sm text-gray-600">국적</span>
                        <p className="font-medium">{reservation.nationality}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 선택 옵션 */}
              {reservation.reservation_options && reservation.reservation_options.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">선택 옵션</h3>
                  <div className="space-y-3">
                    {reservation.reservation_options.map((option, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium text-gray-900">
                            {option.choice.choice_name_ko || option.choice.choice_name}
                          </span>
                          <p className="text-sm text-gray-600">
                            {option.option.option_name_ko || option.option.option_name}
                          </p>
                        </div>
                        {option.option.option_price && (
                          <span className="font-semibold text-blue-600">
                            +${option.option.option_price}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 결제 정보 */}
              {reservation.payment_records && reservation.payment_records.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">결제 정보</h3>
                  <div className="space-y-3">
                    {reservation.payment_records.map((payment, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <CreditCard className="h-5 w-5 text-gray-500 mr-3" />
                          <div>
                            <span className="font-medium text-gray-900">
                              {payment.payment_method === 'card' ? '신용카드' : 
                               payment.payment_method === 'bank_transfer' ? '은행 이체' :
                               payment.payment_method === 'cash' ? '현금' : payment.payment_method}
                            </span>
                            <p className="text-sm text-gray-600">
                              {new Date(payment.submit_on).toLocaleDateString('ko-KR')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900">${payment.amount}</span>
                          <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(payment.payment_status)}`}>
                            {getPaymentStatusLabel(payment.payment_status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 특별 요청사항 */}
              {reservation.special_requests && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">특별 요청사항</h3>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{reservation.special_requests}</p>
                  </div>
                </div>
              )}

              {/* 예약 생성일 */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>예약 생성일: {new Date(reservation.created_at).toLocaleDateString('ko-KR')}</span>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                    <span>예약 확인됨</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
