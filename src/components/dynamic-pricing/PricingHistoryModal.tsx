'use client'

import { useState, useEffect } from 'react'
import { X, History, Calendar, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PricingHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  date: string
  channelId: string
  variantKey: string
  channelName?: string | undefined
  choiceCombinations?: Array<{
    id: string
    combination_name: string
    combination_name_ko?: string
  }>
  priceType?: 'base' | 'dynamic' | 'all'
}

interface PricingHistoryItem {
  id: string
  date: string
  adult_price: number | null
  child_price: number | null
  infant_price: number | null
  commission_percent: number | null
  markup_amount: number | null
  markup_percent: number | null
  coupon_percent: number | null
  not_included_price: number | null
  is_sale_available: boolean | null
  choices_pricing: any
  created_at: string
  updated_at: string
}

export default function PricingHistoryModal({
  isOpen,
  onClose,
  productId,
  date,
  channelId,
  variantKey,
  channelName,
  choiceCombinations = [],
  priceType = 'all'
}: PricingHistoryModalProps) {
  const [history, setHistory] = useState<PricingHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedChoices, setExpandedChoices] = useState<Set<string>>(new Set())
  const [isChannelSinglePrice, setIsChannelSinglePrice] = useState(false)

  useEffect(() => {
    if (isOpen && productId && date && channelId) {
      loadChannelPricingType()
      loadHistory()
    }
  }, [isOpen, productId, date, channelId, variantKey])

  const loadChannelPricingType = async () => {
    try {
      const { data: channelData } = await supabase
        .from('channels')
        .select('pricing_type')
        .eq('id', channelId)
        .single()
      
      if (channelData?.pricing_type) {
        setIsChannelSinglePrice(channelData.pricing_type === 'single')
      } else {
        setIsChannelSinglePrice(false)
      }
    } catch (error) {
      console.warn('채널 pricing_type 조회 오류:', error)
      setIsChannelSinglePrice(false)
    }
  }

  const loadHistory = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('dynamic_pricing')
        .select('*')
        .eq('product_id', productId)
        .eq('date', date)
        .eq('channel_id', channelId)
        .eq('variant_key', variantKey)
      
      // price_type 필터링 (all이 아니면 특정 타입만 조회)
      if (priceType !== 'all') {
        query = query.eq('price_type', priceType)
      }
      
      const { data, error } = await query.order('updated_at', { ascending: false })

      if (error) {
        console.error('가격 히스토리 조회 오류:', error)
        setHistory([])
        return
      }

      // 같은 updated_at을 가진 레코드가 여러 개 있으면 하나로 합치기
      const groupedHistory = (data || []).reduce((acc: PricingHistoryItem[], item: any) => {
        // 같은 updated_at을 가진 레코드 찾기
        const existingIndex = acc.findIndex(h => h.updated_at === item.updated_at)
        
        if (existingIndex >= 0) {
          // 기존 레코드와 합치기 (choices_pricing 병합)
          const existing = acc[existingIndex]
          const existingChoices = parseChoicesPricing(existing.choices_pricing) || {}
          const newChoices = parseChoicesPricing(item.choices_pricing) || {}
          const mergedChoices = { ...existingChoices, ...newChoices }
          
          acc[existingIndex] = {
            ...existing,
            choices_pricing: mergedChoices,
            // 다른 필드도 업데이트 (더 최신 값 우선)
            adult_price: item.adult_price ?? existing.adult_price,
            child_price: item.child_price ?? existing.child_price,
            infant_price: item.infant_price ?? existing.infant_price,
            commission_percent: item.commission_percent ?? existing.commission_percent,
            markup_amount: item.markup_amount ?? existing.markup_amount,
            markup_percent: item.markup_percent ?? existing.markup_percent,
            coupon_percent: item.coupon_percent ?? existing.coupon_percent,
            not_included_price: item.not_included_price ?? existing.not_included_price,
            is_sale_available: item.is_sale_available ?? existing.is_sale_available
          }
        } else {
          acc.push(item)
        }
        
        return acc
      }, [])

      setHistory(groupedHistory)
    } catch (error) {
      console.error('가격 히스토리 조회 중 오류:', error)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return '-'
    return `$${price.toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const getPriceChange = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return null
    const change = current - previous
    if (change === 0) return null
    return change
  }

  const getChoiceName = (choiceId: string): string => {
    const combination = choiceCombinations.find(c => c.id === choiceId)
    if (combination) {
      return combination.combination_name_ko || combination.combination_name || choiceId
    }
    return choiceId
  }

  const toggleChoiceExpansion = (itemId: string) => {
    setExpandedChoices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const parseChoicesPricing = (choicesPricing: any) => {
    if (!choicesPricing) return null
    try {
      if (typeof choicesPricing === 'string') {
        return JSON.parse(choicesPricing)
      }
      return choicesPricing
    } catch {
      return null
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">가격 기록 히스토리</h3>
              <p className="text-sm text-gray-600">
                날짜: {date} | 채널: {channelName || channelId} | Variant: {variantKey}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              해당 조건의 가격 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => {
                const previousItem = index < history.length - 1 ? history[index + 1] : null
                const adultChange = getPriceChange(item.adult_price, previousItem?.adult_price)
                const childChange = getPriceChange(item.child_price, previousItem?.child_price)
                const infantChange = getPriceChange(item.infant_price, previousItem?.infant_price)

                return (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(item.updated_at)}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            최신
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        생성: {formatDate(item.created_at)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* 기본 가격 - choices_pricing이 없을 때만 표시 */}
                      {!item.choices_pricing && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-gray-700 mb-2">기본 가격</h4>
                          <div className="space-y-1">
                            {(() => {
                              const adultPrice = item.adult_price ?? 0
                              const childPrice = item.child_price ?? 0
                              const infantPrice = item.infant_price ?? 0
                              
                              // 단일 가격인지 확인 (세 가격이 모두 같거나, 아동/유아 가격이 0인 경우)
                              const isSinglePrice = (
                                (adultPrice === childPrice && childPrice === infantPrice) ||
                                (childPrice === 0 && infantPrice === 0 && adultPrice > 0)
                              )
                              
                              if (isSinglePrice) {
                                // 단일 가격 표시
                                const totalChange = getPriceChange(adultPrice, previousItem?.adult_price)
                                return (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600">단일 가격:</span>
                                    <div className="flex items-center space-x-1">
                                      <span className="text-sm font-medium">
                                        {formatPrice(adultPrice)}
                                      </span>
                                      {totalChange !== null && totalChange !== 0 && (
                                        <div className={`flex items-center space-x-1 ${
                                          totalChange > 0 ? 'text-red-600' : 'text-blue-600'
                                        }`}>
                                          {totalChange > 0 ? (
                                            <TrendingUp className="h-3 w-3" />
                                          ) : (
                                            <TrendingDown className="h-3 w-3" />
                                          )}
                                          <span className="text-xs">
                                            {totalChange > 0 ? '+' : ''}{formatPrice(totalChange)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              } else {
                                // 성인/아동/유아 가격 별도 표시
                                return (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-gray-600">성인:</span>
                                      <div className="flex items-center space-x-1">
                                        <span className="text-sm font-medium">
                                          {formatPrice(adultPrice)}
                                        </span>
                                        {adultChange !== null && adultChange !== 0 && (
                                          <div className={`flex items-center space-x-1 ${
                                            adultChange > 0 ? 'text-red-600' : 'text-blue-600'
                                          }`}>
                                            {adultChange > 0 ? (
                                              <TrendingUp className="h-3 w-3" />
                                            ) : (
                                              <TrendingDown className="h-3 w-3" />
                                            )}
                                            <span className="text-xs">
                                              {adultChange > 0 ? '+' : ''}{formatPrice(adultChange)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-gray-600">아동:</span>
                                      <div className="flex items-center space-x-1">
                                        <span className="text-sm font-medium">
                                          {formatPrice(childPrice)}
                                        </span>
                                        {childChange !== null && childChange !== 0 && (
                                          <div className={`flex items-center space-x-1 ${
                                            childChange > 0 ? 'text-red-600' : 'text-blue-600'
                                          }`}>
                                            {childChange > 0 ? (
                                              <TrendingUp className="h-3 w-3" />
                                            ) : (
                                              <TrendingDown className="h-3 w-3" />
                                            )}
                                            <span className="text-xs">
                                              {childChange > 0 ? '+' : ''}{formatPrice(childChange)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-gray-600">유아:</span>
                                      <div className="flex items-center space-x-1">
                                        <span className="text-sm font-medium">
                                          {formatPrice(infantPrice)}
                                        </span>
                                        {infantChange !== null && infantChange !== 0 && (
                                          <div className={`flex items-center space-x-1 ${
                                            infantChange > 0 ? 'text-red-600' : 'text-blue-600'
                                          }`}>
                                            {infantChange > 0 ? (
                                              <TrendingUp className="h-3 w-3" />
                                            ) : (
                                              <TrendingDown className="h-3 w-3" />
                                            )}
                                            <span className="text-xs">
                                              {infantChange > 0 ? '+' : ''}{formatPrice(infantChange)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )
                              }
                            })()}
                          </div>
                        </div>
                      )}

                      {/* 수수료 및 마크업 */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">수수료 및 마크업</h4>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">수수료:</span>
                            <span className="text-sm font-medium">
                              {item.commission_percent !== null ? `${item.commission_percent}%` : '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">마크업 금액:</span>
                            <span className="text-sm font-medium">
                              {formatPrice(item.markup_amount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">마크업 %:</span>
                            <span className="text-sm font-medium">
                              {item.markup_percent !== null ? `${item.markup_percent}%` : '-'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">쿠폰 할인:</span>
                            <span className="text-sm font-medium">
                              {item.coupon_percent !== null ? `${item.coupon_percent}%` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 기타 정보 */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">기타 정보</h4>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">불포함 가격:</span>
                            <span className="text-sm font-medium">
                              {formatPrice(item.not_included_price)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">판매 가능:</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              item.is_sale_available
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {item.is_sale_available ? '판매중' : '판매중지'}
                            </span>
                          </div>
                          {item.choices_pricing && (
                            <div className="mt-2">
                              <button
                                onClick={() => toggleChoiceExpansion(item.id)}
                                className="flex items-center justify-between w-full text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors"
                              >
                                <span>초이스별 가격:</span>
                                <span className="text-gray-500">
                                  {Object.keys(parseChoicesPricing(item.choices_pricing) || {}).length}개 초이스
                                  {expandedChoices.has(item.id) ? ' ▲' : ' ▼'}
                                </span>
                              </button>
                              {expandedChoices.has(item.id) && (
                                <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
                                  {Object.entries(parseChoicesPricing(item.choices_pricing) || {}).map(([choiceId, choiceData]: [string, any]) => {
                                    const adultPrice = choiceData.adult_price || choiceData.adult || 0
                                    const childPrice = choiceData.child_price || choiceData.child || 0
                                    const infantPrice = choiceData.infant_price || choiceData.infant || 0
                                    const otaSalePrice = choiceData.ota_sale_price || 0
                                    const notIncludedPrice = choiceData.not_included_price || 0
                                    
                                    // 실제로 설정된 가격이 있는지 확인
                                    // 단일 가격 채널인 경우 성인/아동/유아 가격은 표시하지 않음
                                    const hasAdultChildInfantPrice = !isChannelSinglePrice && (adultPrice > 0 || childPrice > 0 || infantPrice > 0)
                                    const hasOtaPrice = otaSalePrice > 0
                                    const hasNotIncludedPrice = notIncludedPrice > 0
                                    
                                    // 표시할 항목이 없으면 건너뛰기
                                    if (!hasAdultChildInfantPrice && !hasOtaPrice && !hasNotIncludedPrice) {
                                      return null
                                    }
                                    
                                    return (
                                      <div key={choiceId} className="bg-gray-50 rounded p-2 space-y-1">
                                        <div className="font-semibold text-xs text-gray-900">
                                          {getChoiceName(choiceId)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          {/* 성인/아동/유아 가격은 실제 값이 있을 때만 표시 (단일 가격 채널이 아닌 경우만) */}
                                          {hasAdultChildInfantPrice && (() => {
                                            // 단일 가격인지 확인
                                            const isSinglePrice = (
                                              (adultPrice === childPrice && childPrice === infantPrice) ||
                                              (childPrice === 0 && infantPrice === 0 && adultPrice > 0)
                                            )
                                            
                                            if (isSinglePrice) {
                                              return (
                                                <div className="col-span-2">
                                                  <span className="text-gray-600">단일 가격:</span>
                                                  <span className="ml-1 font-medium">
                                                    {formatPrice(adultPrice)}
                                                  </span>
                                                </div>
                                              )
                                            } else {
                                              return (
                                                <>
                                                  {adultPrice > 0 && (
                                                    <div>
                                                      <span className="text-gray-600">성인:</span>
                                                      <span className="ml-1 font-medium">
                                                        {formatPrice(adultPrice)}
                                                      </span>
                                                    </div>
                                                  )}
                                                  {childPrice > 0 && (
                                                    <div>
                                                      <span className="text-gray-600">아동:</span>
                                                      <span className="ml-1 font-medium">
                                                        {formatPrice(childPrice)}
                                                      </span>
                                                    </div>
                                                  )}
                                                  {infantPrice > 0 && (
                                                    <div>
                                                      <span className="text-gray-600">유아:</span>
                                                      <span className="ml-1 font-medium">
                                                        {formatPrice(infantPrice)}
                                                      </span>
                                                    </div>
                                                  )}
                                                </>
                                              )
                                            }
                                          })()}
                                          {/* OTA 판매가는 값이 있을 때만 표시 */}
                                          {hasOtaPrice && (
                                            <div>
                                              <span className="text-gray-600">OTA 판매가:</span>
                                              <span className="ml-1 font-medium text-green-600">
                                                {formatPrice(otaSalePrice)}
                                              </span>
                                            </div>
                                          )}
                                          {/* 불포함 가격은 값이 있을 때만 표시 */}
                                          {hasNotIncludedPrice && (
                                            <div className="col-span-2">
                                              <span className="text-gray-600">불포함 가격:</span>
                                              <span className="ml-1 font-medium">
                                                {formatPrice(notIncludedPrice)}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
