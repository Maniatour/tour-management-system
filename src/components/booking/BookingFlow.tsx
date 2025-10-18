'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Users, Clock, MapPin, CreditCard, ShoppingCart, ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Product {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string
  customer_name_en: string
  base_price: number | null
  duration: string | null
  max_participants: number | null
  departure_city: string | null
  arrival_city: string | null
  departure_country: string | null
  arrival_country: string | null
  languages: string[] | null
  group_size: string | null
  adult_age: number | null
  child_age_min: number | null
  child_age_max: number | null
  infant_age: number | null
  choices: Record<string, unknown> | null
  tour_departure_times: Record<string, unknown> | null
}

interface ProductChoice {
  product_id: string
  product_name: string
  choice_id: string
  choice_name: string
  choice_name_ko: string | null
  choice_type: string
  choice_description: string | null
  option_id: string
  option_name: string
  option_name_ko: string | null
  option_price: number | null
  is_default: boolean | null
}

interface TourSchedule {
  id: string
  product_id: string
  tour_date: string
  departure_time: string | null
  available_spots: number | null
  status: string | null
  team_type: string | null
  guide_id: string | null
  guide_name: string | null
  vehicle_id: string | null
  vehicle_type: string | null
  notes: string | null
}

interface BookingData {
  productId: string
  tourDate: string
  departureTime: string
  participants: {
    adults: number
    children: number
    infants: number
  }
  selectedOptions: Record<string, string>
  totalPrice: number
  customerInfo: {
    name: string
    email: string
    phone: string
    nationality: string
    specialRequests: string
  }
}

interface BookingFlowProps {
  product: Product
  productChoices: ProductChoice[]
  onClose: () => void
  onComplete: (bookingData: BookingData) => void
}

const steps = [
  { id: 'date', title: '날짜 선택', icon: Calendar },
  { id: 'participants', title: '인원 선택', icon: Users },
  { id: 'options', title: '옵션 선택', icon: ShoppingCart },
  { id: 'customer', title: '고객 정보', icon: Users },
  { id: 'payment', title: '결제', icon: CreditCard }
]

export default function BookingFlow({ product, productChoices, onClose, onComplete }: BookingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [tourSchedules, setTourSchedules] = useState<TourSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [bookingData, setBookingData] = useState<BookingData>({
    productId: product.id,
    tourDate: '',
    departureTime: '',
    participants: {
      adults: 1,
      children: 0,
      infants: 0
    },
    selectedOptions: {},
    totalPrice: product.base_price || 0,
    customerInfo: {
      name: '',
      email: '',
      phone: '',
      nationality: '',
      specialRequests: ''
    }
  })

  // 투어 스케줄 로드
  useEffect(() => {
    const loadTourSchedules = async () => {
      try {
        const { data, error } = await supabase
          .from('product_schedules')
          .select('*')
          .eq('product_id', product.id)
          .eq('status', 'active')
          .gte('tour_date', new Date().toISOString().split('T')[0])
          .order('tour_date', { ascending: true })

        if (error) {
          console.error('투어 스케줄 로드 오류:', error)
          return
        }

        setTourSchedules(data || [])
      } catch (error) {
        console.error('투어 스케줄 로드 오류:', error)
      }
    }

    loadTourSchedules()
  }, [product.id])

  // 기본 옵션 설정
  useEffect(() => {
    if (productChoices.length === 0) return
    
    const defaultOptions: Record<string, string> = {}
    
    const tempGroups = productChoices.reduce((groups, choice) => {
      const groupKey = choice.choice_id
      if (!groups[groupKey]) {
        groups[groupKey] = {
          choice_id: choice.choice_id,
          options: []
        }
      }
      groups[groupKey].options.push({
        option_id: choice.option_id,
        is_default: choice.is_default
      })
      return groups
    }, {} as Record<string, { choice_id: string; options: Array<{ option_id: string; is_default: boolean | null }> }>)
    
    Object.values(tempGroups).forEach((group) => {
      const defaultOption = group.options.find((option) => option.is_default)
      if (defaultOption) {
        defaultOptions[group.choice_id] = defaultOption.option_id
      } else if (group.options.length > 0) {
        defaultOptions[group.choice_id] = group.options[0].option_id
      }
    })
    
    setBookingData(prev => ({
      ...prev,
      selectedOptions: defaultOptions
    }))
  }, [productChoices])

  // 가격 계산
  const calculateTotalPrice = () => {
    let totalPrice = product.base_price || 0
    
    // 선택된 옵션 가격 추가
    Object.values(groupedChoices).forEach((group) => {
      const selectedOptionId = bookingData.selectedOptions[group.choice_id]
      if (selectedOptionId) {
        const option = group.options.find((opt) => opt.option_id === selectedOptionId)
        if (option && option.option_price) {
          totalPrice += option.option_price
        }
      }
    })

    // 인원별 가격 계산 (성인 기준)
    const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
    return totalPrice * totalParticipants
  }

  // 선택 옵션을 그룹별로 정리
  const groupedChoices = productChoices.reduce((groups, choice) => {
    const groupKey = choice.choice_id
    if (!groups[groupKey]) {
      groups[groupKey] = {
        choice_id: choice.choice_id,
        choice_name: choice.choice_name,
        choice_name_ko: choice.choice_name_ko,
        choice_type: choice.choice_type,
        choice_description: choice.choice_description,
        options: []
      }
    }
    groups[groupKey].options.push({
      option_id: choice.option_id,
      option_name: choice.option_name,
      option_name_ko: choice.option_name_ko,
      option_price: choice.option_price,
      is_default: choice.is_default
    })
    return groups
  }, {} as Record<string, any>)

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    const finalBookingData = {
      ...bookingData,
      totalPrice: calculateTotalPrice()
    }
    onComplete(finalBookingData)
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 0: // 날짜 선택
        return bookingData.tourDate && bookingData.departureTime
      case 1: // 인원 선택
        return bookingData.participants.adults > 0
      case 2: // 옵션 선택
        return true // 옵션은 선택사항
      case 3: // 고객 정보
        return bookingData.customerInfo.name && bookingData.customerInfo.email && bookingData.customerInfo.phone
      case 4: // 결제
        return true
      default:
        return false
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">투어 날짜 선택</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tourSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      bookingData.tourDate === schedule.tour_date
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setBookingData(prev => ({
                        ...prev,
                        tourDate: schedule.tour_date,
                        departureTime: schedule.departure_time || ''
                      }))
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {new Date(schedule.tour_date).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </div>
                        {schedule.departure_time && (
                          <div className="text-sm text-gray-600 flex items-center mt-1">
                            <Clock className="h-4 w-4 mr-1" />
                            {schedule.departure_time}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">
                          잔여: {schedule.available_spots || 0}명
                        </div>
                        <div className="text-xs text-gray-500">
                          {schedule.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {tourSchedules.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">예약 가능한 날짜가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">인원 선택</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">성인</div>
                    <div className="text-sm text-gray-600">
                      {product.adult_age ? `${product.adult_age}세 이상` : '성인'}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        if (bookingData.participants.adults > 1) {
                          setBookingData(prev => ({
                            ...prev,
                            participants: {
                              ...prev.participants,
                              adults: prev.participants.adults - 1
                            }
                          }))
                        }
                      }}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{bookingData.participants.adults}</span>
                    <button
                      onClick={() => {
                        const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
                        if (totalParticipants < (product.max_participants || 20)) {
                          setBookingData(prev => ({
                            ...prev,
                            participants: {
                              ...prev.participants,
                              adults: prev.participants.adults + 1
                            }
                          }))
                        }
                      }}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {product.child_age_min && product.child_age_max && (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">아동</div>
                      <div className="text-sm text-gray-600">
                        {product.child_age_min}-{product.child_age_max}세
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          if (bookingData.participants.children > 0) {
                            setBookingData(prev => ({
                              ...prev,
                              participants: {
                                ...prev.participants,
                                children: prev.participants.children - 1
                              }
                            }))
                          }
                        }}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{bookingData.participants.children}</span>
                      <button
                        onClick={() => {
                          const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
                          if (totalParticipants < (product.max_participants || 20)) {
                            setBookingData(prev => ({
                              ...prev,
                              participants: {
                                ...prev.participants,
                                children: prev.participants.children + 1
                              }
                            }))
                          }
                        }}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {product.infant_age && (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">유아</div>
                      <div className="text-sm text-gray-600">
                        {product.infant_age}세 미만
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          if (bookingData.participants.infants > 0) {
                            setBookingData(prev => ({
                              ...prev,
                              participants: {
                                ...prev.participants,
                                infants: prev.participants.infants - 1
                              }
                            }))
                          }
                        }}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{bookingData.participants.infants}</span>
                      <button
                        onClick={() => {
                          const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
                          if (totalParticipants < (product.max_participants || 20)) {
                            setBookingData(prev => ({
                              ...prev,
                              participants: {
                                ...prev.participants,
                                infants: prev.participants.infants + 1
                              }
                            }))
                          }
                        }}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">추가 옵션 선택</h3>
              {Object.keys(groupedChoices).length > 0 ? (
                <div className="space-y-4">
                  {Object.values(groupedChoices).map((group: any) => (
                    <div key={group.choice_id} className="border rounded-lg p-4">
                      <div className="mb-3">
                        <h4 className="font-medium text-gray-900">{group.choice_name_ko || group.choice_name}</h4>
                        {group.choice_description && (
                          <p className="text-sm text-gray-600 mt-1">{group.choice_description}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {group.options.map((option: any) => (
                          <label key={option.option_id} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name={group.choice_id}
                              value={option.option_id}
                              checked={bookingData.selectedOptions[group.choice_id] === option.option_id}
                              onChange={(e) => {
                                setBookingData(prev => ({
                                  ...prev,
                                  selectedOptions: {
                                    ...prev.selectedOptions,
                                    [group.choice_id]: e.target.value
                                  }
                                }))
                              }}
                              className="w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1">
                              <span className="text-gray-900">{option.option_name_ko || option.option_name}</span>
                              {option.option_price && (
                                <span className="text-blue-600 font-medium ml-2">
                                  +${option.option_price}
                                </span>
                              )}
                              {option.is_default && (
                                <span className="text-xs text-gray-500 ml-2">(기본)</span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">추가 옵션이 없습니다</p>
                </div>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">고객 정보</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                  <input
                    type="text"
                    value={bookingData.customerInfo.name}
                    onChange={(e) => {
                      setBookingData(prev => ({
                        ...prev,
                        customerInfo: {
                          ...prev.customerInfo,
                          name: e.target.value
                        }
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="이름을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
                  <input
                    type="email"
                    value={bookingData.customerInfo.email}
                    onChange={(e) => {
                      setBookingData(prev => ({
                        ...prev,
                        customerInfo: {
                          ...prev.customerInfo,
                          email: e.target.value
                        }
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="이메일을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 *</label>
                  <input
                    type="tel"
                    value={bookingData.customerInfo.phone}
                    onChange={(e) => {
                      setBookingData(prev => ({
                        ...prev,
                        customerInfo: {
                          ...prev.customerInfo,
                          phone: e.target.value
                        }
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="전화번호를 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">국적</label>
                  <input
                    type="text"
                    value={bookingData.customerInfo.nationality}
                    onChange={(e) => {
                      setBookingData(prev => ({
                        ...prev,
                        customerInfo: {
                          ...prev.customerInfo,
                          nationality: e.target.value
                        }
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="국적을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">특별 요청사항</label>
                  <textarea
                    value={bookingData.customerInfo.specialRequests}
                    onChange={(e) => {
                      setBookingData(prev => ({
                        ...prev,
                        customerInfo: {
                          ...prev.customerInfo,
                          specialRequests: e.target.value
                        }
                      }))
                    }}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="특별 요청사항이 있다면 입력하세요"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">결제 정보</h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 mb-3">예약 요약</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">투어</span>
                    <span className="font-medium">{product.customer_name_ko}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">날짜</span>
                    <span className="font-medium">
                      {bookingData.tourDate && new Date(bookingData.tourDate).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">인원</span>
                    <span className="font-medium">
                      성인 {bookingData.participants.adults}명
                      {bookingData.participants.children > 0 && `, 아동 ${bookingData.participants.children}명`}
                      {bookingData.participants.infants > 0 && `, 유아 ${bookingData.participants.infants}명`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">기본 가격</span>
                    <span className="font-medium">${product.base_price}</span>
                  </div>
                  {Object.values(groupedChoices).map((group: any) => {
                    const selectedOptionId = bookingData.selectedOptions[group.choice_id]
                    if (selectedOptionId) {
                      const option = group.options.find((opt: any) => opt.option_id === selectedOptionId)
                      if (option && option.option_price) {
                        return (
                          <div key={group.choice_id} className="flex justify-between">
                            <span className="text-gray-600">{group.choice_name_ko || group.choice_name}</span>
                            <span className="font-medium">+${option.option_price}</span>
                          </div>
                        )
                      }
                    }
                    return null
                  })}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>총 가격</span>
                      <span className="text-blue-600">${calculateTotalPrice()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">결제 방법</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="card">신용카드</option>
                    <option value="bank_transfer">은행 이체</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm text-blue-800">
                      결제는 예약 확정 후 별도로 안내드립니다.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">예약하기</h2>
              <p className="text-sm text-gray-600">{product.customer_name_ko}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* 진행 단계 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isActive 
                      ? 'border-blue-500 bg-blue-500 text-white' 
                      : isCompleted 
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
          {renderStepContent()}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                currentStep === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              이전
            </button>
            
            <div className="text-right">
              <div className="text-sm text-gray-600">총 가격</div>
              <div className="text-xl font-bold text-blue-600">${calculateTotalPrice()}</div>
            </div>

            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleComplete}
                disabled={!isStepValid()}
                className={`flex items-center px-6 py-2 rounded-lg font-medium transition-colors ${
                  isStepValid()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                예약 완료
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  isStepValid()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                다음
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
