'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Channel {
  id: string
  name: string
  type: 'ota' | 'self' | 'partner'
}

interface ChannelSectionProps {
  formData: {
    selectedChannelType: 'ota' | 'self' | 'partner'
    channelSearch: string
    channelId: string
    variantKey?: string
    productId?: string
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  channels: Channel[]
  t: (key: string) => string
  layout?: 'modal' | 'page'
  onAccordionToggle?: (isExpanded: boolean) => void
}

export default function ChannelSection({
  formData,
  setFormData,
  channels,
  t,
  layout = 'modal',
  onAccordionToggle
}: ChannelSectionProps) {
  const [isExpanded, setIsExpanded] = useState(layout === 'modal')
  const [productVariants, setProductVariants] = useState<Array<{
    variant_key: string;
    variant_name_ko?: string | null;
    variant_name_en?: string | null;
  }>>([])
  const [channelVariants, setChannelVariants] = useState<Record<string, Array<{
    variant_key: string;
    variant_name_ko?: string | null;
    variant_name_en?: string | null;
  }>>>({})
  
  // 모든 채널의 variant 목록 로드 (채널 리스트 표시용)
  useEffect(() => {
    const loadAllChannelVariants = async () => {
      if (channels.length === 0) {
        setChannelVariants({})
        return
      }

      try {
        const channelIds = channels.map(ch => ch.id)
        const { data, error } = await supabase
          .from('channel_products')
          .select('channel_id, variant_key, variant_name_ko, variant_name_en')
          .in('channel_id', channelIds)
          .eq('is_active', true)
          .order('channel_id')
          .order('variant_key')

        if (error) {
          console.error('채널 variant 로드 실패:', error)
          setChannelVariants({})
          return
        }

        // 채널별로 variant 그룹화
        const variantsByChannel: Record<string, Array<{
          variant_key: string;
          variant_name_ko?: string | null;
          variant_name_en?: string | null;
        }>> = {}

        ;(data || []).forEach((item: any) => {
          const channelId = item.channel_id
          if (!variantsByChannel[channelId]) {
            variantsByChannel[channelId] = []
          }
          
          // 중복 제거
          const existing = variantsByChannel[channelId].find(
            v => v.variant_key === (item.variant_key || 'default')
          )
          if (!existing) {
            variantsByChannel[channelId].push({
              variant_key: item.variant_key || 'default',
              variant_name_ko: item.variant_name_ko,
              variant_name_en: item.variant_name_en
            })
          }
        })

        setChannelVariants(variantsByChannel)
      } catch (error) {
        console.error('채널 variant 목록 로드 중 오류:', error)
        setChannelVariants({})
      }
    }

    loadAllChannelVariants()
  }, [channels])

  // 채널과 상품이 선택되었을 때 variant 목록 로드
  useEffect(() => {
    const loadVariants = async () => {
      if (!formData.channelId || !formData.productId) {
        setProductVariants([])
        return
      }

      try {
        const { data, error } = await supabase
          .from('channel_products')
          .select('variant_key, variant_name_ko, variant_name_en')
          .eq('product_id', formData.productId)
          .eq('channel_id', formData.channelId)
          .eq('is_active', true)
          .order('variant_key')

        if (error) {
          console.error('Variant 로드 실패:', error)
          setProductVariants([{ variant_key: 'default' }])
          return
        }

        const variants = (data || []).map((item: any) => ({
          variant_key: item.variant_key || 'default',
          variant_name_ko: item.variant_name_ko,
          variant_name_en: item.variant_name_en
        }))

        setProductVariants(variants.length > 0 ? variants : [{ variant_key: 'default' }])
        
        // 기본 variant 선택 (아직 선택되지 않은 경우)
        if (!formData.variantKey && variants.length > 0) {
          const defaultVariant = variants.find(v => v.variant_key === 'default') || variants[0]
          setFormData((prev: any) => ({
            ...prev,
            variantKey: defaultVariant.variant_key
          }))
        }
      } catch (error) {
        console.error('Variant 목록 로드 중 오류:', error)
        setProductVariants([{ variant_key: 'default' }])
      }
    }

    loadVariants()
  }, [formData.channelId, formData.productId, formData.variantKey, setFormData])
  
  const handleToggle = () => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    if (onAccordionToggle) {
      onAccordionToggle(newExpanded)
    }
  }
  
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-900">{t('form.channel')}</label>
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center text-gray-500 hover:text-gray-700"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {/* 선택된 채널 정보 표시 - 검색창 위에 배치 */}
      {formData.channelId && (
        <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 font-medium">선택된 채널:</span>
              {(() => {
                const selectedChannel = channels.find(c => c.id === formData.channelId)
                return selectedChannel ? (
                  <div className="flex items-center space-x-2">
                    {(selectedChannel as any).favicon_url ? (
                      <img 
                        src={(selectedChannel as any).favicon_url} 
                        alt={`${selectedChannel.name} favicon`} 
                        className="h-4 w-4 rounded flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            const fallback = document.createElement('div')
                            fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                            fallback.innerHTML = '🌐'
                            parent.appendChild(fallback)
                          }
                        }}
                      />
                    ) : (
                      <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                        🌐
                      </div>
                    )}
                    <span className="text-sm text-blue-900 font-medium">{selectedChannel.name}</span>
                  </div>
                ) : null
              })()}
            </div>
            <button
              type="button"
              onClick={() => setFormData((prev: any) => ({ ...prev, channelId: '' }))} // eslint-disable-line @typescript-eslint/no-explicit-any
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-100 rounded"
            >
              해제
            </button>
          </div>
          {/* Variant 선택 (상품이 선택된 경우에만 표시) - 선택된 채널 박스 안에 통합 */}
          {formData.productId && productVariants.length > 0 && (
            <div className="pt-2 border-t border-blue-200">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Variant
              </label>
              <select
                value={formData.variantKey || 'default'}
                onChange={(e) => setFormData((prev: any) => ({
                  ...prev,
                  variantKey: e.target.value
                }))}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {productVariants.map((variant: { variant_key: string; variant_name_ko?: string | null; variant_name_en?: string | null }) => (
                  <option key={variant.variant_key} value={variant.variant_key}>
                    {variant.variant_name_ko || variant.variant_name_en || variant.variant_key}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      
      {/* 채널명 검색 - 아코디언이 펼쳐졌을 때만 표시 */}
      {isExpanded && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="채널명 검색..."
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
            onChange={(e) => setFormData((prev: any) => ({ ...prev, channelSearch: e.target.value }))} // eslint-disable-line @typescript-eslint/no-explicit-any
          />
        </div>
      )}
      
      {/* 채널 선택 리스트 - 아코디언이 펼쳐졌을 때만 표시 */}
      {isExpanded && (
        <div className="border border-gray-300 rounded-lg overflow-hidden">
        {/* 채널 타입별 탭 */}
        <div className="flex bg-gray-50">
          {['self', 'ota', 'partner'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData((prev: any) => ({ ...prev, selectedChannelType: type as 'ota' | 'self' | 'partner' }))} // eslint-disable-line @typescript-eslint/no-explicit-any
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                formData.selectedChannelType === type
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {type === 'self' ? '자체채널' : type === 'ota' ? 'OTA' : '제휴사'}
            </button>
          ))}
        </div>
        
        {/* 채널 선택 리스트 */}
        <div className="h-[770px] overflow-y-auto">
          {channels
            .flatMap(channel => {
              const variants = channelVariants[channel.id] || []
              // variant가 있으면 모든 variant를 별도 항목으로 표시
              if (variants.length > 0) {
                return variants.map(variant => {
                  const variantName = variant.variant_name_ko || variant.variant_name_en
                  // variant_name이 있으면 항상 "채널명 - variant명" 형식으로 표시
                  if (variantName) {
                    return {
                      channel,
                      variant: variant as { variant_key: string; variant_name_ko?: string | null; variant_name_en?: string | null },
                      displayName: `${channel.name} - ${variantName}`
                    }
                  }
                  // variant_name이 없고 variant_key가 'default'가 아니면 variant_key 사용
                  if (variant.variant_key !== 'default') {
                    return {
                      channel,
                      variant: variant as { variant_key: string; variant_name_ko?: string | null; variant_name_en?: string | null },
                      displayName: `${channel.name} - ${variant.variant_key}`
                    }
                  }
                  // variant_name이 없고 variant_key가 'default'이면 채널명만
                  return {
                    channel,
                    variant: variant as { variant_key: string; variant_name_ko?: string | null; variant_name_en?: string | null },
                    displayName: channel.name
                  }
                })
              } else {
                // variant가 없는 경우 채널명만 표시
                return [{
                  channel,
                  variant: { variant_key: 'default' } as { variant_key: string; variant_name_ko?: string | null; variant_name_en?: string | null },
                  displayName: channel.name
                }]
              }
            })
            .filter(({ channel, displayName }) => {
              const matchesType = channel.type === formData.selectedChannelType
              const matchesSearch = !formData.channelSearch || 
                displayName.toLowerCase().includes(formData.channelSearch.toLowerCase())
              return matchesType && matchesSearch
            })
            .map(({ channel, variant, displayName }) => (
              <div
                key={variant ? `${channel.id}-${variant.variant_key}` : channel.id}
                onClick={() => {
                  const isCurrentlySelected = formData.channelId === channel.id && 
                    formData.variantKey === variant.variant_key
                  
                  if (isCurrentlySelected) {
                    // 같은 variant를 다시 클릭하면 선택 해제
                    setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                      ...prev, 
                      channelId: '',
                      variantKey: undefined
                    }))
                  } else if (formData.channelId === channel.id) {
                    // 같은 채널의 다른 variant를 선택하면 variantKey만 변경
                    setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                      ...prev, 
                      channelId: channel.id,
                      variantKey: variant.variant_key
                    }))
                  } else {
                    // 다른 채널을 선택하면 channelId와 variantKey 모두 변경
                    setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                      ...prev, 
                      channelId: channel.id,
                      variantKey: variant.variant_key
                    }))
                  }
                }}
                className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                  formData.channelId === channel.id && formData.variantKey === variant.variant_key
                    ? 'bg-blue-500 border-l-4 border-l-blue-500' 
                    : ''
                }`}
              >
                <div className="flex items-center space-x-2">
                  {((channel as any).favicon_url) ? (
                    <img 
                      src={(channel as any).favicon_url} 
                      alt={`${channel.name} favicon`} 
                      className="h-4 w-4 rounded flex-shrink-0"
                      onError={(e) => {
                        // 파비콘 로드 실패 시 기본 아이콘으로 대체
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          const fallback = document.createElement('div')
                          fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                          fallback.innerHTML = '🌐'
                          parent.appendChild(fallback)
                        }
                      }}
                    />
                  ) : (
                    <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                      🌐
                    </div>
                  )}
                  <div className="text-sm text-gray-900">{displayName}</div>
                </div>
              </div>
            ))}
        </div>
        </div>
      )}
    </div>
  )
}
