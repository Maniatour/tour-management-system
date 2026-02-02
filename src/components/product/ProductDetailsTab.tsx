'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Save, AlertCircle, Settings, Languages, Loader2, Sparkles, Users, Copy, ChevronRight, ChevronDown, CheckSquare, Square } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import CommonDetailsModal from './CommonDetailsModal'
import { translateProductDetailsFields, type ProductDetailsTranslationFields } from '@/lib/translationService'
import { suggestTourDescription } from '@/lib/chatgptService'
import LightRichEditor from '@/components/LightRichEditor'

interface ProductDetailsFields {
  slogan1: string
  slogan2: string
  slogan3: string
  description: string
  included: string
  not_included: string
  pickup_drop_info: string
  luggage_info: string
  tour_operation_info: string
  preparation_info: string
  small_group_info: string
  notice_info: string
  private_tour_info: string
  cancellation_policy: string
  chat_announcement: string
  tags: string[]
}

interface MultilingualProductDetails {
  [languageCode: string]: ProductDetailsFields
}

interface ProductDetailsMultilingualRow {
  id: string
  product_id: string
  language_code: string
  slogan1: string | null
  slogan2: string | null
  slogan3: string | null
  description: string | null
  included: string | null
  not_included: string | null
  pickup_drop_info: string | null
  luggage_info: string | null
  tour_operation_info: string | null
  preparation_info: string | null
  small_group_info: string | null
  notice_info: string | null
  private_tour_info: string | null
  cancellation_policy: string | null
  chat_announcement: string | null
  tags: string[] | null
  created_at: string | null
  updated_at: string | null
}

interface ProductDetailsFormData {
  useCommonDetails: boolean
  productDetails: MultilingualProductDetails
  currentLanguage: string
  // 각 필드별 공통 정보 사용 여부
  useCommonForField: {
    [languageCode: string]: {
      slogan1: boolean
      slogan2: boolean
      slogan3: boolean
      description: boolean
      included: boolean
      not_included: boolean
      pickup_drop_info: boolean
      luggage_info: boolean
      tour_operation_info: boolean
      preparation_info: boolean
      small_group_info: boolean
      notice_info: boolean
      private_tour_info: boolean
      cancellation_policy: boolean
      chat_announcement: boolean
      tags: boolean
    }
  }
}

interface ProductDetailsTabProps {
  productId: string
  isNewProduct: boolean
  subCategory: string
  formData: ProductDetailsFormData
  setFormData: React.Dispatch<React.SetStateAction<ProductDetailsFormData>>
}

interface Channel {
  id: string
  name: string
  type: string
}

interface ChannelGroup {
  type: string
  channels: Channel[]
}

interface ChannelSelection {
  [channelId: string]: boolean
}

export default function ProductDetailsTab({
  productId,
  isNewProduct,
  subCategory,
  formData,
  setFormData
}: ProductDetailsTabProps) {
  const t = useTranslations('products.detailsTab')
  const tDetails = useTranslations('products.detailsPage')

  const getCopyFieldLabel = (field: string | null) => {
    if (!field) return ''
    if (field === 'slogan') return t('slogan')
    if (field === 'included_not_included') return t('includedNotIncluded')
    if (field === 'description') return tDetails('description')
    if (field === 'pickup_drop_info') return t('pickupDropInfo')
    if (field === 'luggage_info') return t('luggageInfo')
    if (field === 'tour_operation_info') return t('tourOperationInfo')
    if (field === 'preparation_info') return t('preparationInfo')
    if (field === 'small_group_info') return t('smallGroupInfo')
    if (field === 'notice_info') return t('noticeInfo')
    if (field === 'private_tour_info') return t('privateTourInfo')
    if (field === 'cancellation_policy') return t('cancellationPolicy')
    if (field === 'chat_announcement') return t('chatAnnouncement')
    return field
  }

  const [saving, setSaving] = useState(false)
  const [saveMessageType, setSaveMessageType] = useState<'success' | 'error' | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [commonPreview, setCommonPreview] = useState<MultilingualProductDetails | null>(null)
  const [availableLanguages] = useState(['ko', 'en', 'ja', 'zh'])
  const [isCommonModalOpen, setIsCommonModalOpen] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  // const [loadingCommon, setLoadingCommon] = useState(false)

  // 채널 관련 상태
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelGroups, setChannelGroups] = useState<ChannelGroup[]>([])
  const [selectedChannels, setSelectedChannels] = useState<ChannelSelection>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [loadingChannelData, setLoadingChannelData] = useState(false)
  const [_copyFromChannel, _setCopyFromChannel] = useState<string | null>(null)
  const [channelPricingStats, setChannelPricingStats] = useState<Record<string, Record<string, number>>>({})
  
  // 채널별 데이터 완성도 상태
  const [channelCompletionStats, setChannelCompletionStats] = useState<Record<string, {
    completed: number;
    total: number;
    percentage: number;
    missingFields: string[];
  }>>({})
  
  // 완성도 필터 상태
  const [completionFilter, setCompletionFilter] = useState<'all' | 'incomplete' | 'empty'>('all')
  
  // 복사 모달 상태
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copyFieldName, setCopyFieldName] = useState<string | null>(null)
  const [copyTargetChannels, setCopyTargetChannels] = useState<Record<string, boolean>>({})
  
  // Variant 관리 상태 (채널별 variant 선택)
  const [channelVariants, setChannelVariants] = useState<Record<string, string>>({}) // channelId -> variant_key
  const [productVariantsByChannel, setProductVariantsByChannel] = useState<Record<string, Array<{
    variant_key: string;
    variant_name_ko?: string | null;
    variant_name_en?: string | null;
  }>>>({}) // channelId -> variants[]

  const supabase = createClientSupabase()
  const { user, loading: authLoading } = useAuth()

  // 로딩 상태는 부모 컴포넌트에서 관리
  useEffect(() => {
    setLoading(false)
  }, [])

  // 채널 목록 로드
  const loadChannels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, type')
        .order('type, name')

      if (error) throw error
      
      const channelsData = (data || []) as Channel[]
      
      // 중복 제거: 같은 ID를 가진 채널이 있으면 첫 번째 것만 사용
      const uniqueChannelsById = new Map<string, Channel>()
      channelsData.forEach(channel => {
        if (!uniqueChannelsById.has(channel.id)) {
          uniqueChannelsById.set(channel.id, channel)
        } else {
          // 중복된 ID 발견 시 로그
          console.warn(`중복된 채널 ID 발견: ${channel.id} (${channel.name})`)
        }
      })
      
      // 같은 이름을 가진 채널도 확인 (디버깅용)
      const channelsByName = new Map<string, Channel[]>()
      Array.from(uniqueChannelsById.values()).forEach(channel => {
        if (!channelsByName.has(channel.name)) {
          channelsByName.set(channel.name, [])
        }
        channelsByName.get(channel.name)!.push(channel)
      })
      
      // 같은 이름을 가진 채널이 여러 개인 경우 로그
      channelsByName.forEach((channels, name) => {
        if (channels.length > 1) {
          console.warn(`같은 이름을 가진 채널이 ${channels.length}개 있습니다: ${name}`, 
            channels.map(c => ({ id: c.id, name: c.name, type: c.type })))
        }
      })
      
      const deduplicatedChannels = Array.from(uniqueChannelsById.values())
      setChannels(deduplicatedChannels)
      
      // 채널을 타입별로 그룹화
      const groups: ChannelGroup[] = []
      const typeMap = new Map<string, Channel[]>()
      
      deduplicatedChannels.forEach(channel => {
        if (!typeMap.has(channel.type)) {
          typeMap.set(channel.type, [])
        }
        typeMap.get(channel.type)!.push(channel)
      })
      
      typeMap.forEach((channels, type) => {
        groups.push({ type, channels })
      })
      
      setChannelGroups(groups)
      
      // 모든 그룹을 기본적으로 접힘
      const expanded: Record<string, boolean> = {}
      groups.forEach(group => {
        expanded[group.type] = false
      })
      setExpandedGroups(expanded)
      
    } catch (error) {
      console.error('채널 목록 로드 오류:', error)
    }
  }, [supabase])

  // 채널별 가격 통계 로드 함수
  const loadChannelPricingStats = useCallback(async () => {
    if (!productId) return;

    try {
      // 모든 채널의 동적 가격 데이터 가져오기 (channels 테이블과 JOIN)
      // JOIN이 실패할 수 있으므로 left join 사용
      let { data, error } = await supabase
        .from('dynamic_pricing')
        .select(`
          channel_id,
          date,
          channels(id, name)
        `)
        .eq('product_id', productId);

      // JOIN이 실패하면 채널 정보 없이 시도
      if (error) {
        console.warn('채널 JOIN 실패, 채널 정보 없이 재시도:', error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('dynamic_pricing')
          .select('channel_id, date')
          .eq('product_id', productId);
        
        if (fallbackError) {
          console.error('채널별 가격 통계 로드 오류:', fallbackError);
          return;
        }
        data = fallbackData?.map((row: { channel_id: string | null; date: string }) => ({ ...row, channels: null })) ?? null;
      }

      // 날짜 정규화 함수 (YYYY-MM-DD 형식으로 변환)
      const normalizeDate = (dateStr: string | null | undefined): string | null => {
        if (!dateStr) return null;
        
        const str = String(dateStr).trim();
        // 이미 YYYY-MM-DD 형식인지 확인
        if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return str;
        }
        
        // 날짜 문자열에서 YYYY-MM-DD 추출
        const dateMatch = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (dateMatch) {
          const year = dateMatch[1];
          const month = String(parseInt(dateMatch[2], 10)).padStart(2, '0');
          const day = String(parseInt(dateMatch[3], 10)).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        // Date 객체로 파싱 시도
        try {
          const date = new Date(str);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        } catch (e) {
          // 파싱 실패
        }
        
        return null;
      };

      // 채널별로 그룹화하고 연도별 날짜 수 계산
      // channel_id와 channel name 모두로 매칭 가능하도록 저장
      const statsById: Record<string, Record<string, Set<string>>> = {};
      const statsByName: Record<string, Record<string, Set<string>>> = {};
      
      if (data) {
        data.forEach((item: any) => {
          const channelId = item.channel_id;
          const channelName = item.channels?.name;
          const normalizedDate = normalizeDate(item.date);
          
          if (!normalizedDate) {
            // 날짜가 유효하지 않으면 건너뛰기
            return;
          }
          
          const year = normalizedDate.split('-')[0];

          // channel_id로 매칭
          if (channelId) {
            if (!statsById[channelId]) {
              statsById[channelId] = {};
            }
            if (!statsById[channelId][year]) {
              statsById[channelId][year] = new Set();
            }
            statsById[channelId][year].add(normalizedDate);
          }

          // channel name으로도 매칭 (같은 이름의 다른 ID 채널을 위해)
          if (channelName) {
            if (!statsByName[channelName]) {
              statsByName[channelName] = {};
            }
            if (!statsByName[channelName][year]) {
              statsByName[channelName][year] = new Set();
            }
            statsByName[channelName][year].add(normalizedDate);
          }
        });
      }

      // Set을 개수로 변환
      const formattedStatsById: Record<string, Record<string, number>> = {};
      Object.keys(statsById).forEach(channelId => {
        formattedStatsById[channelId] = {};
        Object.keys(statsById[channelId]).forEach(year => {
          formattedStatsById[channelId][year] = statsById[channelId][year].size;
        });
      });

      const formattedStatsByName: Record<string, Record<string, number>> = {};
      Object.keys(statsByName).forEach(channelName => {
        formattedStatsByName[channelName] = {};
        Object.keys(statsByName[channelName]).forEach(year => {
          formattedStatsByName[channelName][year] = statsByName[channelName][year].size;
        });
      });

      // 통계를 ID와 이름 모두로 저장
      const allStats: Record<string, Record<string, number>> = {
        ...formattedStatsById,
        // 이름으로도 접근 가능하도록 추가 (같은 이름의 채널이 여러 개일 경우)
        ...formattedStatsByName
      };

      // 디버깅: 통계 데이터 확인
      console.log('채널별 가격 통계 로드 결과:', {
        totalRecords: data?.length || 0,
        uniqueChannelIds: Object.keys(formattedStatsById),
        uniqueChannelNames: Object.keys(formattedStatsByName),
        statsById: formattedStatsById,
        statsByName: formattedStatsByName
      });

      setChannelPricingStats(allStats);
    } catch (error) {
      console.error('채널별 가격 통계 로드 오류:', error);
    }
  }, [productId, supabase]);

  // 선택된 채널들의 세부 정보 로드
  const loadSelectedChannelData = useCallback(async (overrideVariants?: Record<string, string>) => {
    const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
    if (selectedChannelIds.length === 0) {
      // 채널이 선택되지 않았으면 일반 데이터 로드 (loadProductDetails는 나중에 호출)
      return
    }

    setLoadingChannelData(true)
    try {
      // overrideVariants가 제공되면 사용, 아니면 현재 channelVariants 사용
      const variantsToUse = overrideVariants || channelVariants

      // self 채널과 OTA 채널을 분리
      const selectedChannelsData = selectedChannelIds.map(id => {
        const channel = channels.find(c => c.id === id)
        return { id, type: channel?.type || 'unknown' }
      })

      const selfChannels = selectedChannelsData.filter(c => c.type === 'self' || c.type === 'SELF')
      const otaChannels = selectedChannelsData.filter(c => c.type !== 'self' && c.type !== 'SELF')

      // 조회할 channel_id 목록 생성
      const channelIdsToQuery: string[] = []
      const variantKeysByChannel: Record<string, string> = {} // channelId -> variant_key
      
      // self 채널이 선택된 경우 'SELF_GROUP' 추가
      if (selfChannels.length > 0) {
        channelIdsToQuery.push('SELF_GROUP')
        // self 채널의 variant는 첫 번째 선택된 self 채널의 variant 사용
        const firstSelfChannelId = selfChannels[0].id
        variantKeysByChannel['SELF_GROUP'] = variantsToUse[firstSelfChannelId] || 'default'
      }
      
      // OTA 채널들의 개별 ID 추가
      otaChannels.forEach(channel => {
        channelIdsToQuery.push(channel.id)
        variantKeysByChannel[channel.id] = variantsToUse[channel.id] || 'default'
      })

      if (channelIdsToQuery.length === 0) {
        setLoadingChannelData(false)
        return
      }

      // 각 채널별로 variant_key를 포함하여 조회
      // 여러 채널이 선택된 경우 각각 조회해야 함
      let allData: any[] = []
      
      for (const channelId of channelIdsToQuery) {
        const variantKey = variantKeysByChannel[channelId] || 'default'
        const { data: channelData, error: channelError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('channel_id', channelId)
          .eq('variant_key', variantKey) as {
            data: Array<{
              channel_id: string | null
              language_code: string | null
              variant_key?: string | null
              slogan1: string | null
              slogan2: string | null
              slogan3: string | null
              description: string | null
              included: string | null
              not_included: string | null
              pickup_drop_info: string | null
              luggage_info: string | null
              tour_operation_info: string | null
              preparation_info: string | null
              small_group_info: string | null
              notice_info: string | null
              private_tour_info: string | null
              cancellation_policy: string | null
              chat_announcement: string | null
              tags: string[] | null
            }> | null
            error: unknown
          }
        
        if (channelError) {
          console.error(`채널 ${channelId} 데이터 로드 오류:`, channelError)
          continue
        }
        
        if (channelData) {
          allData = [...allData, ...channelData]
        }
      }

      const data = allData.length > 0 ? allData : null

      console.log('선택된 채널 데이터 로드됨:', data)

      // 채널별 데이터를 formData에 반영
      if (data && data.length > 0) {
        const multilingualDetails: Record<string, ProductDetailsFields> = {}
        
        // 각 언어별로 모든 채널의 데이터를 병합
        // 첫 번째 채널의 데이터를 기본으로 하고, 비어있는 필드는 다른 채널의 데이터로 채움
        data.forEach((item) => {
          const langCode = item.language_code || 'ko'
          if (!multilingualDetails[langCode]) {
            // 첫 번째 채널의 데이터로 초기화
            multilingualDetails[langCode] = {
              slogan1: item.slogan1 ?? '',
              slogan2: item.slogan2 ?? '',
              slogan3: item.slogan3 ?? '',
              description: item.description ?? '',
              included: item.included ?? '',
              not_included: item.not_included ?? '',
              pickup_drop_info: item.pickup_drop_info ?? '',
              luggage_info: item.luggage_info ?? '',
              tour_operation_info: item.tour_operation_info ?? '',
              preparation_info: item.preparation_info ?? '',
              small_group_info: item.small_group_info ?? '',
              notice_info: item.notice_info ?? '',
              private_tour_info: item.private_tour_info ?? '',
              cancellation_policy: item.cancellation_policy ?? '',
              chat_announcement: item.chat_announcement ?? '',
              tags: item.tags ?? []
            }
          } else {
            // 이미 있는 경우, 비어있는 필드를 현재 채널의 데이터로 채움
            const existing = multilingualDetails[langCode]
            const hasValue = (value: string | null | undefined) => value && value.trim() !== ''
            
            multilingualDetails[langCode] = {
              slogan1: hasValue(existing.slogan1) ? existing.slogan1 : (item.slogan1 ?? ''),
              slogan2: hasValue(existing.slogan2) ? existing.slogan2 : (item.slogan2 ?? ''),
              slogan3: hasValue(existing.slogan3) ? existing.slogan3 : (item.slogan3 ?? ''),
              description: hasValue(existing.description) ? existing.description : (item.description ?? ''),
              included: hasValue(existing.included) ? existing.included : (item.included ?? ''),
              not_included: hasValue(existing.not_included) ? existing.not_included : (item.not_included ?? ''),
              pickup_drop_info: hasValue(existing.pickup_drop_info) ? existing.pickup_drop_info : (item.pickup_drop_info ?? ''),
              luggage_info: hasValue(existing.luggage_info) ? existing.luggage_info : (item.luggage_info ?? ''),
              tour_operation_info: hasValue(existing.tour_operation_info) ? existing.tour_operation_info : (item.tour_operation_info ?? ''),
              preparation_info: hasValue(existing.preparation_info) ? existing.preparation_info : (item.preparation_info ?? ''),
              small_group_info: hasValue(existing.small_group_info) ? existing.small_group_info : (item.small_group_info ?? ''),
              notice_info: hasValue(existing.notice_info) ? existing.notice_info : (item.notice_info ?? ''),
              private_tour_info: hasValue(existing.private_tour_info) ? existing.private_tour_info : (item.private_tour_info ?? ''),
              cancellation_policy: hasValue(existing.cancellation_policy) ? existing.cancellation_policy : (item.cancellation_policy ?? ''),
              chat_announcement: hasValue(existing.chat_announcement) ? existing.chat_announcement : (item.chat_announcement ?? ''),
              tags: existing.tags.length > 0 ? existing.tags : (item.tags ?? [])
            }
          }
        })
        
        console.log('채널별 데이터 병합 결과:', multilingualDetails)

        // 기본 한국어 데이터가 없으면 빈 데이터 추가
        if (!multilingualDetails.ko) {
          multilingualDetails.ko = {
            slogan1: '',
            slogan2: '',
            slogan3: '',
            description: '',
            included: '',
            not_included: '',
            pickup_drop_info: '',
            luggage_info: '',
            tour_operation_info: '',
            preparation_info: '',
            small_group_info: '',
            notice_info: '',
            private_tour_info: '',
            cancellation_policy: '',
            chat_announcement: '',
            tags: []
          }
        }

        console.log('채널별 데이터를 formData에 반영:', multilingualDetails)
        // 현재 formData와 비교하여 변경이 있을 때만 업데이트
        setFormData(prev => {
          const currentLang = prev.currentLanguage || 'ko'
          const currentDetails = prev.productDetails?.[currentLang]
          const newDetails = multilingualDetails[currentLang]
          
          // 데이터가 실제로 변경되었는지 확인
          if (currentDetails && newDetails && 
              JSON.stringify(currentDetails) === JSON.stringify(newDetails)) {
            return prev // 변경사항이 없으면 이전 상태 반환
          }
          
          return {
            ...prev,
            productDetails: multilingualDetails
          }
        })
      }
    } catch (error) {
      console.error('선택된 채널 데이터 로드 오류:', error)
    } finally {
      setLoadingChannelData(false)
    }
  }, [selectedChannels, productId, supabase, setFormData, channels, channelVariants])

  // 채널별 variant 목록 로드
  useEffect(() => {
    const loadChannelVariants = async () => {
      const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
      if (selectedChannelIds.length === 0) {
        setProductVariantsByChannel({})
        return
      }

      const variantsByChannel: Record<string, Array<{
        variant_key: string;
        variant_name_ko?: string | null;
        variant_name_en?: string | null;
      }>> = {}

      const newChannelVariants: Record<string, string> = { ...channelVariants }

      try {
        for (const channelId of selectedChannelIds) {
          const { data, error } = await supabase
            .from('channel_products')
            .select('variant_key, variant_name_ko, variant_name_en')
            .eq('product_id', productId)
            .eq('channel_id', channelId)
            .eq('is_active', true)
            .order('variant_key')

          if (error) {
            console.error(`채널 ${channelId} variant 로드 실패:`, error)
            continue
          }

          const variants = (data || []).map((item: any) => ({
            variant_key: item.variant_key || 'default',
            variant_name_ko: item.variant_name_ko,
            variant_name_en: item.variant_name_en
          }))

          variantsByChannel[channelId] = variants.length > 0 ? variants : [{ variant_key: 'default' }]
          
          // 기본 variant 선택 (아직 선택되지 않은 경우)
          if (!channelVariants[channelId]) {
            newChannelVariants[channelId] = variants.length > 0 && variants.find(v => v.variant_key === 'default')
              ? 'default'
              : variants.length > 0
              ? variants[0].variant_key
              : 'default'
          }
        }

        setProductVariantsByChannel(variantsByChannel)
        
        // 새로운 variant가 설정된 경우에만 업데이트
        if (Object.keys(newChannelVariants).length > Object.keys(channelVariants).length ||
            Object.keys(newChannelVariants).some(key => newChannelVariants[key] !== channelVariants[key])) {
          setChannelVariants(newChannelVariants)
        }
      } catch (error) {
        console.error('Variant 목록 로드 중 오류:', error)
      }
    }

    loadChannelVariants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannels, productId, supabase])

  // 채널 선택 토글
  const toggleChannelSelection = (channelId: string) => {
    setSelectedChannels(prev => ({
      ...prev,
      [channelId]: !prev[channelId]
    }))
    
    // 채널 선택 해제 시 variant도 제거
    if (selectedChannels[channelId]) {
      setChannelVariants(prev => {
        const newVariants = { ...prev }
        delete newVariants[channelId]
        return newVariants
      })
    }
  }

  // 그룹 전체 선택/해제
  const toggleGroupSelection = (groupType: string) => {
    const group = channelGroups.find(g => g.type === groupType)
    if (!group) return

    const allSelected = group.channels.every(channel => selectedChannels[channel.id])
    
    setSelectedChannels(prev => {
      const newSelection = { ...prev }
      group.channels.forEach(channel => {
        newSelection[channel.id] = !allSelected
      })
      return newSelection
    })
  }

  // 그룹 확장/축소 토글
  const toggleGroupExpansion = (groupType: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupType]: !prev[groupType]
    }))
  }

  // 특정 필드만 복사하는 함수
  const copyFieldToChannels = async (fieldName: string, toChannelIds: string[]) => {
    if (!fieldName || toChannelIds.length === 0) return

    try {
      const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
      if (selectedChannelIds.length === 0) {
        setSaveMessage(t('msgSelectChannelsToCopy'))
        setSaveMessageType('error')
        setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
        return
      }

      // 현재 언어의 필드 값 가져오기
      const currentLang = formData.currentLanguage || 'ko'
      const currentDetails = getCurrentLanguageDetails()
      
      // 복사할 필드 목록 결정
      const fieldsToCopy: string[] = []
      if (fieldName === 'slogan') {
        fieldsToCopy.push('slogan1', 'slogan2', 'slogan3')
      } else if (fieldName === 'included_not_included') {
        fieldsToCopy.push('included', 'not_included')
      } else {
        fieldsToCopy.push(fieldName)
      }

      // 복사 대상 채널들을 그룹화
      const toChannelsData = toChannelIds.map(id => {
        const channel = channels.find(c => c.id === id)
        return { id, type: channel?.type || 'unknown' }
      })
      const selfTargets = toChannelsData.filter(c => c.type === 'self' || c.type === 'SELF')
      const otaTargets = toChannelsData.filter(c => c.type !== 'self' && c.type !== 'SELF')

      const channelGroupsToSave: Array<{ channelIds: string[], channelId: string }> = []

      if (selfTargets.length > 0) {
        channelGroupsToSave.push({
          channelIds: selfTargets.map(c => c.id),
          channelId: 'SELF_GROUP'
        })
      }

      otaTargets.forEach(channel => {
        channelGroupsToSave.push({
          channelIds: [channel.id],
          channelId: channel.id
        })
      })

      const copyPromises = channelGroupsToSave.map(async (group) => {
        const targetVariantKey = group.channelIds.length === 1
          ? (channelVariants[group.channelIds[0]] || 'default')
          : 'default'

        // 기존 데이터 확인
        const existingResult = await supabase
          .from('product_details_multilingual')
          .select('id')
          .eq('product_id', productId)
          .eq('channel_id', group.channelId)
          .eq('language_code', currentLang)
          .eq('variant_key', targetVariantKey)
          .maybeSingle() as { data: { id: string } | null; error: { code?: string } | null }

        if (existingResult.error && existingResult.error.code !== 'PGRST116') {
          throw existingResult.error
        }

        const existingData = existingResult.data

        const updateData: any = {
          updated_at: new Date().toISOString()
        }
        
        // 복사할 필드들 추가
        fieldsToCopy.forEach(field => {
          updateData[field] = (currentDetails as any)[field]
        })

        if (existingData) {
          // 업데이트
          const { error: updateError } = await supabase
            .from('product_details_multilingual')
            .update(updateData)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .eq('id', (existingData as any).id)

          if (updateError) throw updateError
        } else {
          // 새로 생성 (기본값으로)
          const insertData: any = {
            product_id: productId,
            channel_id: group.channelId,
            language_code: currentLang,
            variant_key: targetVariantKey
          }
          fieldsToCopy.forEach(field => {
            insertData[field] = (currentDetails as any)[field]
          })
          const { error: insertError } = await (supabase as any)
            .from('product_details_multilingual')
            .insert([insertData])

          if (insertError) throw insertError
        }
      })

      await Promise.all(copyPromises)
      loadSelectedChannelData()
      setSaveMessage(t('msgCopyToChannelsSuccess', { count: toChannelIds.length }))
      setSaveMessageType('success')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
      setCopyModalOpen(false)
      setCopyTargetChannels({})
    } catch (error) {
      console.error('필드 복사 오류:', error)
      setSaveMessage(`${t('msgCopyError')}: ${error instanceof Error ? error.message : ''}`)
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
    }
  }

  // 복사 모달 열기
  const openCopyModal = (fieldName: string) => {
    setCopyFieldName(fieldName)
    // 현재 선택되지 않은 모든 채널을 복사 대상으로 초기화
    const allChannelIds = channels.map(c => c.id)
    const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
    const unselectedChannels: Record<string, boolean> = {}
    allChannelIds.forEach(id => {
      if (!selectedChannelIds.includes(id)) {
        unselectedChannels[id] = false
      }
    })
    setCopyTargetChannels(unselectedChannels)
    setCopyModalOpen(true)
  }

  // 채널 간 복사
  // 미사용 - 추후 채널 간 복사 기능용
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _copyChannelData = async (fromChannelId: string, toChannelIds: string[]) => {
    if (!fromChannelId || toChannelIds.length === 0) return

    try {
      // fromChannelId가 'SELF_GROUP'인 경우 실제 channel_id로 변환
      const actualFromChannelId = fromChannelId === 'SELF_GROUP' ? 'SELF_GROUP' : fromChannelId
      
      // 복사 소스의 variant_key 가져오기
      const sourceVariantKey = actualFromChannelId === 'SELF_GROUP'
        ? (channelVariants[Object.keys(selectedChannels).find(id => {
            const ch = channels.find(c => c.id === id)
            return ch?.type === 'self' || ch?.type === 'SELF'
          }) || ''] || 'default')
        : (channelVariants[actualFromChannelId] || 'default')
      
      const { data: sourceData, error: fetchError } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('channel_id', actualFromChannelId)
        .eq('variant_key', sourceVariantKey)

      if (fetchError) throw fetchError

      if (sourceData && sourceData.length > 0) {
        // 복사 대상 채널들을 그룹화
        const toChannelsData = toChannelIds.map(id => {
          const channel = channels.find(c => c.id === id)
          return { id, type: channel?.type || 'unknown' }
        })
        const selfTargets = toChannelsData.filter(c => c.type === 'self' || c.type === 'SELF')
        const otaTargets = toChannelsData.filter(c => c.type !== 'self' && c.type !== 'SELF')

        // 저장할 채널 그룹 정의
        const channelGroupsToSave: Array<{ channelIds: string[], channelId: string }> = []

        // self 채널들은 하나의 그룹으로 처리
        if (selfTargets.length > 0) {
          channelGroupsToSave.push({
            channelIds: selfTargets.map(c => c.id),
            channelId: 'SELF_GROUP'
          })
        }

        // OTA 채널들은 각각 개별적으로 저장
        otaTargets.forEach(channel => {
          channelGroupsToSave.push({
            channelIds: [channel.id],
            channelId: channel.id
          })
        })

        const copyPromises = channelGroupsToSave.map(async (group) => {
          // 복사 대상의 variant_key 가져오기
          const targetVariantKey = group.channelIds.length === 1
            ? (channelVariants[group.channelIds[0]] || 'default')
            : 'default'
          
          for (const sourceItem of sourceData as Array<{
            language_code: string
            variant_key?: string | null
            slogan1: string | null
            slogan2: string | null
            slogan3: string | null
            description: string | null
            included: string | null
            not_included: string | null
            pickup_drop_info: string | null
            luggage_info: string | null
            tour_operation_info: string | null
            preparation_info: string | null
            small_group_info: string | null
            notice_info: string | null
            private_tour_info: string | null
            cancellation_policy: string | null
            chat_announcement: string | null
            tags: string[] | null
          }>) {
            const copyData = {
              product_id: productId,
              channel_id: group.channelId, // self 채널은 'SELF_GROUP', OTA는 개별 channel_id
              language_code: sourceItem.language_code,
              variant_key: targetVariantKey, // variant_key 추가
              slogan1: sourceItem.slogan1,
              slogan2: sourceItem.slogan2,
              slogan3: sourceItem.slogan3,
              description: sourceItem.description,
              included: sourceItem.included,
              not_included: sourceItem.not_included,
              pickup_drop_info: sourceItem.pickup_drop_info,
              luggage_info: sourceItem.luggage_info,
              tour_operation_info: sourceItem.tour_operation_info,
              preparation_info: sourceItem.preparation_info,
              small_group_info: sourceItem.small_group_info,
              notice_info: sourceItem.notice_info,
              private_tour_info: sourceItem.private_tour_info,
              cancellation_policy: sourceItem.cancellation_policy,
              chat_announcement: sourceItem.chat_announcement,
              tags: sourceItem.tags
            }

            // 기존 데이터 확인
            const { data: existingData, error: selectError } = await supabase
              .from('product_details_multilingual')
              .select('id')
              .eq('product_id', productId)
              .eq('channel_id', group.channelId)
              .eq('language_code', sourceItem.language_code)
              .eq('variant_key', targetVariantKey)
              .maybeSingle()

            if (selectError && selectError.code !== 'PGRST116') {
              console.error(`채널 그룹 ${group.channelId} 데이터 확인 오류:`, selectError)
              throw selectError
            }

            if (existingData) {
              // 업데이트
              const { error: updateError } = await supabase
                .from('product_details_multilingual')
                .update({
                  ...copyData,
                  updated_at: new Date().toISOString()
                })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .eq('id', (existingData as any).id)

              if (updateError) {
                console.error(`채널 그룹 ${group.channelId} 복사 오류:`, updateError)
                throw new Error(`채널 그룹 ${group.channelId} 복사 실패: ${updateError.message}`)
              }
            } else {
              // 삽입
              const { error: insertError } = await supabase
                .from('product_details_multilingual')
                .insert([copyData])

              if (insertError) {
                console.error(`채널 그룹 ${group.channelId} 복사 오류:`, insertError)
                throw new Error(`채널 그룹 ${group.channelId} 복사 실패: ${insertError.message}`)
              }
            }
          }
        })

        await Promise.all(copyPromises)
        
        // 복사 후 데이터 새로고침
        loadSelectedChannelData()
        
        setSaveMessage(t('msgCopyDataSuccess', { count: toChannelIds.length }))
        setSaveMessageType('success')
        setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
      }
    } catch (error) {
      console.error('채널 데이터 복사 오류:', error)
      
      let errorMessage = ''
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String((error as { message?: string }).message)
        } else if ('error' in error) {
          errorMessage = String((error as { error?: unknown }).error)
        }
      }
      
      setSaveMessage(`${t('msgChannelCopyError')}: ${errorMessage || ''}`)
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
    }
  }

  // 선택된 채널들에 세부 정보 저장
  const saveSelectedChannelsDetails = async () => {
    const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
    if (selectedChannelIds.length === 0) {
      setSaveMessage(t('msgSelectChannelsToSave'))
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
      return
    }

    setSaving(true)
    setSaveMessage('')
    setSaveMessageType(null)

    try {
      const currentLang = formData.currentLanguage || 'ko'
      const currentDetails = getCurrentLanguageDetails()

      // self 채널과 OTA 채널을 분리
      const selectedChannelsData = selectedChannelIds.map(id => {
        const channel = channels.find(c => c.id === id)
        return { id, type: channel?.type || 'unknown' }
      })

      const selfChannels = selectedChannelsData.filter(c => c.type === 'self' || c.type === 'SELF')
      const otaChannels = selectedChannelsData.filter(c => c.type !== 'self' && c.type !== 'SELF')

      // 저장할 채널 그룹 정의
      const channelGroupsToSave: Array<{ channelIds: string[], channelId: string, channelType: string }> = []

      // self 채널들은 하나의 그룹으로 처리 (channel_id = 'SELF_GROUP')
      if (selfChannels.length > 0) {
        channelGroupsToSave.push({
          channelIds: selfChannels.map(c => c.id),
          channelId: 'SELF_GROUP', // self 채널들은 모두 같은 channel_id를 사용
          channelType: 'self'
        })
      }

      // OTA 채널들은 각각 개별적으로 저장
      otaChannels.forEach(channel => {
        channelGroupsToSave.push({
          channelIds: [channel.id],
          channelId: channel.id, // 각 OTA 채널은 고유한 channel_id 사용
          channelType: channel.type
        })
      })

      const savePromises = channelGroupsToSave.map(async (group) => {
        // 빈 문자열을 null로 변환하는 헬퍼 함수
        // HTML 태그만 있는 빈 문자열도 처리
        const toNullIfEmpty = (value: string | null | undefined): string | null => {
          if (value === null || value === undefined) return null
          if (typeof value !== 'string') return null
          
          // HTML 태그 제거 후 trim
          const textContent = value.replace(/<[^>]*>/g, '').trim()
          if (textContent === '') return null
          
          return value
        }
        
        // 선택된 variant 가져오기 (각 채널별로)
        const groupVariantKey = group.channelIds.length === 1 
          ? (channelVariants[group.channelIds[0]] || 'default')
          : 'default' // 여러 채널이면 default 사용
        
        const detailsData = {
          product_id: productId,
          channel_id: group.channelId, // self 채널은 'SELF_GROUP', OTA는 개별 channel_id
          language_code: currentLang,
          variant_key: groupVariantKey, // variant_key 추가
          slogan1: toNullIfEmpty(currentDetails.slogan1),
          slogan2: toNullIfEmpty(currentDetails.slogan2),
          slogan3: toNullIfEmpty(currentDetails.slogan3),
          description: toNullIfEmpty(currentDetails.description),
          included: toNullIfEmpty(currentDetails.included),
          not_included: toNullIfEmpty(currentDetails.not_included),
          pickup_drop_info: toNullIfEmpty(currentDetails.pickup_drop_info),
          luggage_info: toNullIfEmpty(currentDetails.luggage_info),
          tour_operation_info: toNullIfEmpty(currentDetails.tour_operation_info),
          preparation_info: toNullIfEmpty(currentDetails.preparation_info),
          small_group_info: toNullIfEmpty(currentDetails.small_group_info),
          notice_info: toNullIfEmpty(currentDetails.notice_info),
          private_tour_info: toNullIfEmpty(currentDetails.private_tour_info),
          cancellation_policy: toNullIfEmpty(currentDetails.cancellation_policy),
          chat_announcement: toNullIfEmpty(currentDetails.chat_announcement),
          tags: currentDetails.tags ?? null
        }
        
        const channelIdLabel = group.channelId === 'SELF_GROUP' 
          ? `self 채널 그룹 (${group.channelIds.length}개)` 
          : group.channelId

        console.log(`채널 그룹 ${channelIdLabel} 저장할 상세 정보:`, {
          channelIds: group.channelIds,
          channelId: group.channelId,
          variant_key: groupVariantKey,
          private_tour_info: detailsData.private_tour_info,
          private_tour_info_type: typeof detailsData.private_tour_info,
          private_tour_info_length: detailsData.private_tour_info?.length,
          chat_announcement: detailsData.chat_announcement,
          chat_announcement_type: typeof detailsData.chat_announcement,
          chat_announcement_length: detailsData.chat_announcement?.length,
          original_private_tour_info: currentDetails.private_tour_info,
          original_private_tour_info_length: currentDetails.private_tour_info?.length,
          original_chat_announcement: currentDetails.chat_announcement,
          original_chat_announcement_length: currentDetails.chat_announcement?.length,
          formData_private_tour_info: formData.productDetails?.[currentLang]?.private_tour_info,
          formData_private_tour_info_length: formData.productDetails?.[currentLang]?.private_tour_info?.length,
          formData_chat_announcement: formData.productDetails?.[currentLang]?.chat_announcement,
          formData_chat_announcement_length: formData.productDetails?.[currentLang]?.chat_announcement?.length,
          allFields: detailsData
        })
        
        // 기존 데이터 확인 (product_id, channel_id, language_code, variant_key 조합으로)
        const { data: existingData, error: selectError } = await supabase
          .from('product_details_multilingual')
          .select('id')
          .eq('product_id', productId)
          .eq('channel_id', group.channelId)
          .eq('language_code', currentLang)
          .eq('variant_key', groupVariantKey)
          .maybeSingle()

        if (selectError && selectError.code !== 'PGRST116') {
          console.error(`채널 그룹 ${channelIdLabel} 데이터 확인 오류:`, selectError)
          throw selectError
        }

        if (existingData) {
          // 업데이트
          const { error: updateError } = await supabase
            .from('product_details_multilingual')
            .update({
              ...detailsData,
              updated_at: new Date().toISOString()
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .eq('id', (existingData as any).id)
          
          if (updateError) {
            console.error(`채널 그룹 ${channelIdLabel} 업데이트 오류:`, updateError)
            throw new Error(`채널 그룹 ${channelIdLabel} 업데이트 실패: ${updateError.message}`)
          } else {
            // 업데이트 후 실제 저장된 값 확인
            const { data: savedData, error: verifyError } = await supabase
              .from('product_details_multilingual')
              .select('private_tour_info, chat_announcement')
              .eq('product_id', productId)
              .eq('channel_id', group.channelId)
              .eq('language_code', currentLang)
              .eq('variant_key', groupVariantKey)
              .maybeSingle() as { data: { private_tour_info: string | null; chat_announcement: string | null } | null; error: unknown }
            
            if (!verifyError && savedData) {
              console.log(`채널 그룹 ${channelIdLabel} 저장 후 확인:`, {
                private_tour_info: savedData.private_tour_info,
                private_tour_info_length: savedData.private_tour_info?.length,
                chat_announcement: savedData.chat_announcement,
                chat_announcement_length: savedData.chat_announcement?.length
              })
            }
          }
        } else {
          // 이제 unique constraint가 (product_id, language_code, channel_id)로 업데이트되었으므로
          // 직접 insert를 시도하고, 중복 오류가 발생하면 업데이트
          const { error: insertError } = await supabase
            .from('product_details_multilingual')
            .insert([detailsData])
          
          if (insertError) {
            // 중복 키 오류인 경우 (23505) - 이미 같은 (product_id, language_code, channel_id) 조합이 존재
            if (insertError.code === '23505') {
              // 기존 레코드를 찾아 업데이트
              const { data: existingRecord, error: findError } = await supabase
                .from('product_details_multilingual')
                .select('id')
                .eq('product_id', productId)
                .eq('language_code', currentLang)
                .eq('channel_id', group.channelId)
                .eq('variant_key', groupVariantKey)
                .maybeSingle()

              if (findError && findError.code !== 'PGRST116') {
                console.error(`채널 그룹 ${channelIdLabel} 생성 오류 (중복 키 후 재확인 실패):`, findError)
                throw new Error(`채널 그룹 ${channelIdLabel} 생성 실패: ${insertError.message}`)
              }

              if (existingRecord) {
                const { error: updateError } = await supabase
                  .from('product_details_multilingual')
                  .update({
                    ...detailsData,
                    updated_at: new Date().toISOString()
                  })
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .eq('id', (existingRecord as any).id)

                if (updateError) {
                  console.error(`채널 그룹 ${channelIdLabel} 업데이트 오류:`, updateError)
                  throw new Error(`채널 그룹 ${channelIdLabel} 업데이트 실패: ${updateError.message}`)
                } else {
                  // 업데이트 후 실제 저장된 값 확인
                  const { data: savedData, error: verifyError } = await supabase
                    .from('product_details_multilingual')
                    .select('private_tour_info, chat_announcement')
                    .eq('product_id', productId)
                    .eq('channel_id', group.channelId)
                    .eq('language_code', currentLang)
                    .eq('variant_key', groupVariantKey)
                    .maybeSingle() as { data: { private_tour_info: string | null; chat_announcement: string | null } | null; error: unknown }
                  
                  if (!verifyError && savedData) {
                    console.log(`채널 그룹 ${channelIdLabel} 저장 후 확인 (중복키 처리):`, {
                      private_tour_info: savedData.private_tour_info,
                      private_tour_info_length: savedData.private_tour_info?.length,
                      chat_announcement: savedData.chat_announcement,
                      chat_announcement_length: savedData.chat_announcement?.length
                    })
                  }
                }
              } else {
                console.error(`채널 그룹 ${channelIdLabel} 생성 오류 (레코드를 찾을 수 없음):`, insertError)
                throw new Error(`채널 그룹 ${channelIdLabel} 생성 실패: ${insertError.message}`)
              }
            } else {
              console.error(`채널 그룹 ${channelIdLabel} 생성 오류:`, insertError)
              throw new Error(`채널 그룹 ${channelIdLabel} 생성 실패: ${insertError.message}`)
            }
          }
        }
      })

      await Promise.all(savePromises)

      setSaveMessage(`${selectedChannelIds.length}개 채널의 세부 정보가 성공적으로 저장되었습니다!`)
      setTimeout(() => setSaveMessage(''), 3000)
      
      // 저장 후 데이터 새로고침
      loadSelectedChannelData()
      // 완성도 통계도 새로고침
      loadChannelCompletionStats()
    } catch (error) {
      console.error('선택된 채널 세부 정보 저장 오류:', error)
      
      // 에러 메시지 생성
      let errorMessage = '알 수 없는 오류'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        // Supabase 에러 객체인 경우
        if ('message' in error) {
          errorMessage = String(error.message)
        } else if ('error' in error) {
          errorMessage = String(error.error)
        }
      }
      
      setSaveMessage(`채널별 세부 정보 저장 중 오류가 발생했습니다: ${errorMessage}`)
      setTimeout(() => setSaveMessage(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  // 상품 세부정보 로드 함수
  const loadProductDetails = useCallback(async () => {
    if (isNewProduct) return

    try {
      // 상품 기본 정보에서 공통 세부정보 사용 여부 확인
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('use_common_details, sub_category')
        .eq('id', productId)
        .single() as { data: { use_common_details: boolean | null; sub_category: string | null } | null, error: unknown }

      if (productError) throw productError

      let detailsData: Array<{
        channel_id: string | null
        language_code: string | null
        slogan1: string | null
        slogan2: string | null
        slogan3: string | null
        description: string | null
        included: string | null
        not_included: string | null
        pickup_drop_info: string | null
        luggage_info: string | null
        tour_operation_info: string | null
        preparation_info: string | null
        small_group_info: string | null
        notice_info: string | null
        private_tour_info: string | null
        cancellation_policy: string | null
        chat_announcement: string | null
        tags: string[] | null
      }> | { channel_id: string | null; language_code: string | null; slogan1: string | null; slogan2: string | null; slogan3: string | null; description: string | null; included: string | null; not_included: string | null; pickup_drop_info: string | null; luggage_info: string | null; tour_operation_info: string | null; preparation_info: string | null; small_group_info: string | null; notice_info: string | null; private_tour_info: string | null; cancellation_policy: string | null; chat_announcement: string | null; tags: string[] | null } | null = null
      let detailsError: { code?: string } | null = null

      if (productData?.use_common_details && productData.sub_category) {
        // 공통 세부정보 사용
        const { data: commonData, error: commonError } = await supabase
          .from('product_details_common_multilingual')
          .select('*')
          .eq('sub_category', productData.sub_category)
          .maybeSingle()
        detailsData = commonData ? { ...commonData, channel_id: null } : null
        detailsError = commonError
      } else {
        // 개별 세부정보 사용 - 모든 데이터를 로드한 후 channel_id가 NULL인 것을 우선 사용
        const { data: allData, error: allError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId) as { 
            data: Array<{
              channel_id: string | null
              language_code: string | null
              slogan1: string | null
              slogan2: string | null
              slogan3: string | null
              description: string | null
              included: string | null
              not_included: string | null
              pickup_drop_info: string | null
              luggage_info: string | null
              tour_operation_info: string | null
              preparation_info: string | null
              small_group_info: string | null
              notice_info: string | null
              private_tour_info: string | null
              cancellation_policy: string | null
              chat_announcement: string | null
              tags: string[] | null
            }> | null
            error: unknown
          }
        
        if (allError) {
          console.error('데이터 로드 오류:', allError)
          detailsData = null
          detailsError = allError
        } else if (allData && allData.length > 0) {
          console.log('로드된 모든 데이터:', allData)
          // 각 항목의 channel_id 확인
          allData.forEach((item, index) => {
            console.log(`데이터 ${index}: language_code=${item.language_code}, channel_id=${item.channel_id}, channel_id === null: ${item.channel_id === null}`)
          })
          
          // 각 언어별로 데이터를 병합하여 사용
          // channel_id가 NULL인 데이터를 기본으로 하고, 채널별 데이터에서 비어있는 필드를 채워넣음
          const languageMap = new Map<string, typeof allData[0]>()
          
          // 먼저 channel_id가 NULL인 데이터를 언어별로 저장 (기본 데이터)
          allData.forEach(item => {
            if ((item.channel_id === null || item.channel_id === undefined) && item.language_code) {
              const lang = item.language_code
              if (!languageMap.has(lang)) {
                languageMap.set(lang, item)
              }
            }
          })
          
          // 채널별 데이터에서 비어있는 필드를 채워넣음
          allData.forEach(item => {
            if (item.language_code) {
              const lang = item.language_code
              const existing = languageMap.get(lang)
              
              if (!existing) {
                // 기본 데이터가 없으면 채널별 데이터를 사용
                languageMap.set(lang, item)
              } else {
                // 기본 데이터가 있으면, 비어있는 필드를 채널별 데이터로 채움
                // 특히 private_tour_info 같은 필드가 비어있으면 채널별 데이터 사용
                const needsMerge = (
                  (!existing.private_tour_info || existing.private_tour_info.trim() === '') &&
                  item.private_tour_info && item.private_tour_info.trim() !== ''
                ) || (
                  (!existing.chat_announcement || existing.chat_announcement.trim() === '') &&
                  item.chat_announcement && item.chat_announcement.trim() !== ''
                )
                
                if (needsMerge) {
                  // 병합: 기존 데이터를 유지하되, 비어있는 필드는 채널별 데이터로 채움
                  languageMap.set(lang, {
                    ...existing,
                    private_tour_info: existing.private_tour_info && existing.private_tour_info.trim() !== '' 
                      ? existing.private_tour_info 
                      : (item.private_tour_info || existing.private_tour_info),
                    chat_announcement: existing.chat_announcement && existing.chat_announcement.trim() !== ''
                      ? existing.chat_announcement
                      : (item.chat_announcement || existing.chat_announcement)
                  } as typeof allData[0])
                }
              }
            }
          })
          
          // Map을 배열로 변환
          detailsData = Array.from(languageMap.values())
          console.log('언어별로 선택된 데이터:', detailsData)
          console.log('사용할 데이터 길이:', detailsData?.length)
          detailsData.forEach((item, idx) => {
            console.log(`[${idx}] language_code: ${item.language_code}, channel_id: ${item.channel_id}, private_tour_info: ${item.private_tour_info ? item.private_tour_info.substring(0, 50) + '...' : '(empty)'}`)
          })
          detailsError = null
        } else {
          console.log('데이터가 없습니다.')
          detailsData = null
          detailsError = null
        }
      }

      if (detailsError && detailsError.code !== 'PGRST116') { // PGRST116은 데이터가 없을 때 발생
        throw detailsError
      }

      // 다국어 데이터를 언어별로 매핑
      const multilingualDetails: Record<string, ProductDetailsFields> = {}
      
      console.log('매핑 전 detailsData:', detailsData)
      console.log('매핑 전 detailsData 타입:', Array.isArray(detailsData) ? '배열' : typeof detailsData)
      console.log('매핑 전 detailsData 길이:', Array.isArray(detailsData) ? detailsData.length : 'N/A')
      
      if (Array.isArray(detailsData) && detailsData.length > 0) {
        // 여러 언어 데이터가 있는 경우
        console.log('배열 순회 시작, 항목 수:', detailsData.length)
        detailsData.forEach((item, index) => {
          const langCode = item.language_code || 'ko'
          console.log(`[${index}] 언어 ${langCode} 데이터 매핑:`, item)
          console.log(`[${index}] item.channel_id:`, item.channel_id)
          console.log(`[${index}] item.language_code:`, item.language_code)
          multilingualDetails[langCode] = {
            slogan1: item.slogan1 ?? '',
            slogan2: item.slogan2 ?? '',
            slogan3: item.slogan3 ?? '',
            description: item.description ?? '',
            included: item.included ?? '',
            not_included: item.not_included ?? '',
            pickup_drop_info: item.pickup_drop_info ?? '',
            luggage_info: item.luggage_info ?? '',
            tour_operation_info: item.tour_operation_info ?? '',
            preparation_info: item.preparation_info ?? '',
            small_group_info: item.small_group_info ?? '',
            notice_info: item.notice_info ?? '',
            private_tour_info: item.private_tour_info ?? '',
            cancellation_policy: item.cancellation_policy ?? '',
            chat_announcement: item.chat_announcement ?? '',
            tags: item.tags ?? []
          }
        })
      } else if (detailsData && !Array.isArray(detailsData)) {
        // 단일 언어 데이터가 있는 경우
        console.log('단일 언어 데이터:', detailsData)
        const item = detailsData as {
          language_code: string | null
          slogan1: string | null
          slogan2: string | null
          slogan3: string | null
          description: string | null
          included: string | null
          not_included: string | null
          pickup_drop_info: string | null
          luggage_info: string | null
          tour_operation_info: string | null
          preparation_info: string | null
          small_group_info: string | null
          notice_info: string | null
          private_tour_info: string | null
          cancellation_policy: string | null
          chat_announcement: string | null
          tags: string[] | null
        }
        const langCode = item.language_code || 'ko'
        multilingualDetails[langCode] = {
          slogan1: item.slogan1 ?? '',
          slogan2: item.slogan2 ?? '',
          slogan3: item.slogan3 ?? '',
          description: item.description ?? '',
          included: item.included ?? '',
          not_included: item.not_included ?? '',
          pickup_drop_info: item.pickup_drop_info ?? '',
          luggage_info: item.luggage_info ?? '',
          tour_operation_info: item.tour_operation_info ?? '',
          preparation_info: item.preparation_info ?? '',
          small_group_info: item.small_group_info ?? '',
          notice_info: item.notice_info ?? '',
          private_tour_info: item.private_tour_info ?? '',
          cancellation_policy: item.cancellation_policy ?? '',
          chat_announcement: item.chat_announcement ?? '',
          tags: item.tags ?? []
        }
      }
      
      console.log('매핑 후 multilingualDetails:', multilingualDetails)

      // 기본 한국어 데이터가 없으면 빈 데이터 추가
      if (!multilingualDetails.ko) {
        multilingualDetails.ko = {
          slogan1: '',
          slogan2: '',
          slogan3: '',
          description: '',
          included: '',
          not_included: '',
          pickup_drop_info: '',
          luggage_info: '',
          tour_operation_info: '',
          preparation_info: '',
          small_group_info: '',
          notice_info: '',
          private_tour_info: '',
          cancellation_policy: '',
          chat_announcement: '',
          tags: []
        }
      }

      // formData 업데이트
      console.log('formData 업데이트 전 multilingualDetails:', multilingualDetails)
      console.log('multilingualDetails.ko:', multilingualDetails.ko)
      console.log('multilingualDetails.en:', multilingualDetails.en)
      
      setFormData(prev => {
        // 현재 데이터와 비교하여 변경이 있을 때만 업데이트
        const currentLang = prev.currentLanguage || 'ko'
        const currentDetails = prev.productDetails?.[currentLang]
        const newDetails = multilingualDetails[currentLang]
        
        // 데이터가 실제로 변경되었는지 확인
        if (currentDetails && newDetails && 
            JSON.stringify(currentDetails) === JSON.stringify(newDetails) &&
            prev.useCommonDetails === !!productData?.use_common_details) {
          return prev // 변경사항이 없으면 이전 상태 반환
        }
        
        return {
          ...prev,
          productDetails: multilingualDetails,
          useCommonDetails: !!productData?.use_common_details
        }
      })

      console.log('상품 세부정보 로드 완료:', multilingualDetails)
    } catch (error) {
      console.error('상품 세부정보 로드 오류:', error)
    }
  }, [productId, isNewProduct, supabase, setFormData])

  // 초기 로드 (한 번만 실행)
  useEffect(() => {
    loadChannels()
    if (!isNewProduct) {
      loadProductDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 의존성 배열을 비워서 한 번만 실행

  // 채널별 데이터 완성도 계산 함수
  const loadChannelCompletionStats = useCallback(async () => {
    if (isNewProduct || !productId || channels.length === 0) {
      setChannelCompletionStats({})
      return
    }

    try {
      // 현재 선택된 언어 사용
      const currentLang = formData.currentLanguage || 'ko'

      const completionStats: Record<string, {
        completed: number;
        total: number;
        percentage: number;
        missingFields: string[];
      }> = {}

      // 필수 필드 목록
      const requiredFields = [
        'slogan1', 'slogan2', 'slogan3',
        'description',
        'included', 'not_included',
        'pickup_drop_info',
        'luggage_info',
        'tour_operation_info',
        'preparation_info',
        'small_group_info',
        'notice_info',
        'private_tour_info',
        'cancellation_policy',
        'chat_announcement'
      ]

      // 각 채널별로 완성도 계산
      for (const channel of channels) {
        const channelId = channel.type === 'self' || channel.type === 'SELF' 
          ? 'SELF_GROUP' 
          : channel.id

        // 해당 채널의 모든 variant 데이터 가져오기 (현재 선택된 언어 기준)
        const { data: channelData, error } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('channel_id', channelId)
          .eq('language_code', currentLang) // 현재 선택된 언어 기준으로 계산

        if (error && error.code !== 'PGRST116') {
          console.error(`채널 ${channel.id} 완성도 계산 오류:`, error)
          continue
        }

        // 모든 variant의 데이터를 병합하여 확인
        const allVariantsData = channelData || []
        
        // 각 variant별로 완성도 계산하고, 가장 높은 완성도를 채널 완성도로 사용
        let maxCompleted = 0
        let maxTotal = requiredFields.length
        let maxMissingFields: string[] = []

        if (allVariantsData.length === 0) {
          // 데이터가 전혀 없는 경우
          completionStats[channel.id] = {
            completed: 0,
            total: maxTotal,
            percentage: 0,
            missingFields: requiredFields
          }
        } else {
          // 각 variant별로 완성도 계산
          const variantCompletions = allVariantsData.map((variantData: any) => {
            let completed = 0
            const missing: string[] = []

            requiredFields.forEach(field => {
              const value = variantData[field]
              const hasValue = value !== null && value !== undefined && 
                              (typeof value === 'string' ? value.trim() !== '' : true)
              
              if (hasValue) {
                completed++
              } else {
                missing.push(field)
              }
            })

            return { completed, missing }
          })

          // 가장 높은 완성도 찾기
          const bestCompletion = variantCompletions.reduce((best, current) => 
            current.completed > best.completed ? current : best
          , { completed: 0, missing: requiredFields })

          maxCompleted = bestCompletion.completed
          maxMissingFields = bestCompletion.missing
        }

        completionStats[channel.id] = {
          completed: maxCompleted,
          total: maxTotal,
          percentage: Math.round((maxCompleted / maxTotal) * 100),
          missingFields: maxMissingFields
        }
      }

      setChannelCompletionStats(completionStats)
    } catch (error) {
      console.error('채널별 완성도 계산 오류:', error)
      setChannelCompletionStats({})
    }
  }, [productId, channels, isNewProduct, supabase, formData.currentLanguage])

  // 채널 목록이 로드된 후 통계 로드
  useEffect(() => {
    if (channels.length > 0 && !isNewProduct && productId) {
      loadChannelPricingStats()
      loadChannelCompletionStats()
    }
  }, [channels.length, isNewProduct, productId, loadChannelPricingStats, loadChannelCompletionStats])

  // 채널 선택 변경 시 데이터 로드
  useEffect(() => {
    const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
    if (selectedChannelIds.length === 0) {
      // 채널이 선택되지 않았으면 일반 데이터 로드
      loadProductDetails()
    } else {
      // 채널이 선택되었으면 채널별 데이터 로드
      loadSelectedChannelData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannels])

  // 현재 언어의 상세 정보 가져오기
  const getCurrentLanguageDetails = (): ProductDetailsFields => {
    const currentLang = formData.currentLanguage || 'ko'
    const existingDetails = formData.productDetails?.[currentLang] || {}
    
    // 각 필드가 없으면 기본값을 사용하도록 보장
    const details: ProductDetailsFields = {
      slogan1: existingDetails.slogan1 ?? '',
      slogan2: existingDetails.slogan2 ?? '',
      slogan3: existingDetails.slogan3 ?? '',
      description: existingDetails.description ?? '',
      included: existingDetails.included ?? '',
      not_included: existingDetails.not_included ?? '',
      pickup_drop_info: existingDetails.pickup_drop_info ?? '',
      luggage_info: existingDetails.luggage_info ?? '',
      tour_operation_info: existingDetails.tour_operation_info ?? '',
      preparation_info: existingDetails.preparation_info ?? '',
      small_group_info: existingDetails.small_group_info ?? '',
      notice_info: existingDetails.notice_info ?? '',
      private_tour_info: existingDetails.private_tour_info ?? '',
      cancellation_policy: existingDetails.cancellation_policy ?? '',
      chat_announcement: existingDetails.chat_announcement ?? '',
      tags: existingDetails.tags ?? []
    }
    
    // 디버깅: 현재 언어의 상세 정보 확인
    console.log('=== ProductDetailsTab Debug ===')
    console.log('currentLang:', currentLang)
    console.log('formData.productDetails:', formData.productDetails)
    console.log('formData.productDetails[currentLang]:', formData.productDetails?.[currentLang])
    console.log('existingDetails.private_tour_info:', existingDetails.private_tour_info, 'type:', typeof existingDetails.private_tour_info, 'hasField:', 'private_tour_info' in existingDetails)
    console.log('existingDetails.chat_announcement:', existingDetails.chat_announcement, 'type:', typeof existingDetails.chat_announcement, 'hasField:', 'chat_announcement' in existingDetails)
    console.log('details.private_tour_info:', details.private_tour_info, 'length:', details.private_tour_info?.length)
    console.log('details.chat_announcement:', details.chat_announcement, 'length:', details.chat_announcement?.length)
    
    return details
  }

  // 현재 언어의 공통 정보 사용 여부 가져오기
  const getCurrentLanguageUseCommon = (): {
    slogan1: boolean
    slogan2: boolean
    slogan3: boolean
    description: boolean
    included: boolean
    not_included: boolean
    pickup_drop_info: boolean
    luggage_info: boolean
    tour_operation_info: boolean
    preparation_info: boolean
    small_group_info: boolean
    notice_info: boolean
    private_tour_info: boolean
    cancellation_policy: boolean
    chat_announcement: boolean
    tags: boolean
  } => {
    const currentLang = formData.currentLanguage || 'ko'
    return formData.useCommonForField?.[currentLang] || {
      slogan1: false,
      slogan2: false,
      slogan3: false,
      description: false,
      included: false,
      not_included: false,
      pickup_drop_info: false,
      luggage_info: false,
      tour_operation_info: false,
      preparation_info: false,
      small_group_info: false,
      notice_info: false,
      private_tour_info: false,
      cancellation_policy: false,
      chat_announcement: false,
      tags: false
    }
  }

  // 언어 변경 핸들러
  const handleLanguageChange = (newLanguage: string) => {
    setFormData(prev => ({
      ...prev,
      currentLanguage: newLanguage
    }))
  }

  // 공통 세부정보 프리뷰 로드 함수
  const loadCommon = useCallback(async () => {
    if (!formData.useCommonDetails || !subCategory) {
      setCommonPreview(null)
      return
    }
    // setLoadingCommon(true)
    try {
      const { data, error } = await supabase
        .from('product_details_common_multilingual')
        .select('*')
        .eq('sub_category', subCategory)
        .in('language_code', availableLanguages) as { data: ProductDetailsMultilingualRow[] | null, error: unknown }

      if (error) throw error

      if (data && data.length > 0) {
        const mapped: MultilingualProductDetails = {}
        data.forEach(item => {
          mapped[item.language_code] = {
            slogan1: item.slogan1 || '',
            slogan2: item.slogan2 || '',
            slogan3: item.slogan3 || '',
            description: item.description || '',
            included: item.included || '',
            not_included: item.not_included || '',
            pickup_drop_info: item.pickup_drop_info || '',
            luggage_info: item.luggage_info || '',
            tour_operation_info: item.tour_operation_info || '',
            preparation_info: item.preparation_info || '',
            small_group_info: item.small_group_info || '',
            notice_info: item.notice_info || '',
            private_tour_info: item.private_tour_info || '',
            cancellation_policy: item.cancellation_policy || '',
            chat_announcement: item.chat_announcement || '',
            tags: item.tags || []
          }
        })
        setCommonPreview(mapped)
      } else {
        setCommonPreview(null)
      }
    } catch (error) {
      console.error('Error loading common details:', error)
      setCommonPreview(null)
    } finally {
      // setLoadingCommon(false)
    }
  }, [formData.useCommonDetails, subCategory, availableLanguages, supabase])

  // 공통 세부정보 프리뷰 로드
  useEffect(() => {
    loadCommon()
  }, [loadCommon])

  const getValue = (field: keyof ProductDetailsFields, forceChannelData = false) => {
    const currentLang = formData.currentLanguage || 'ko'
    const currentDetails = getCurrentLanguageDetails()
    const currentUseCommon = getCurrentLanguageUseCommon()
    
    // 채널이 선택된 경우 또는 강제로 채널 데이터를 사용하는 경우
    // 공통 정보를 사용하지 않고 채널별 데이터만 사용
    const hasSelectedChannels = Object.keys(selectedChannels).filter(id => selectedChannels[id]).length > 0
    
    if (forceChannelData || hasSelectedChannels) {
      // 채널별 데이터만 사용
      return currentDetails[field] ?? ''
    }
    
    // 각 필드별로 공통 정보 사용 여부 확인
    if (currentUseCommon[field]) {
      return (commonPreview?.[currentLang]?.[field] ?? '') as string
    }
    return currentDetails[field] ?? ''
  }

  const handleInputChange = (field: keyof ProductDetailsFields, value: string) => {
    const currentLang = formData.currentLanguage || 'ko'
    console.log(`handleInputChange 호출: field=${field}, value=`, value?.substring(0, 100), `length=${value?.length}, type=${typeof value}`)
    console.log(`handleInputChange 이전 formData:`, {
      before: formData.productDetails?.[currentLang]?.[field],
      beforeType: typeof formData.productDetails?.[currentLang]?.[field]
    })
    
    setFormData((prev) => {
      const updated = {
        ...prev,
        productDetails: {
          ...prev.productDetails,
          [currentLang]: {
            ...prev.productDetails?.[currentLang],
            [field]: value
          }
        }
      }
      console.log(`handleInputChange 후 formData 업데이트:`, {
        field,
        newValue: updated.productDetails[currentLang]?.[field],
        newValueType: typeof updated.productDetails[currentLang]?.[field],
        newValueLength: updated.productDetails[currentLang]?.[field]?.length,
        fullProductDetails: updated.productDetails[currentLang]
      })
      return updated
    })
  }

  // const handleUseCommonChange = (field: keyof ProductDetailsFields, useCommon: boolean) => {
  //   const currentLang = formData.currentLanguage || 'ko'
  //   setFormData((prev) => {
  //     const currentUseCommonForField = prev.useCommonForField?.[currentLang] || {
  //       slogan1: false,
  //       slogan2: false,
  //       slogan3: false,
  //       description: false,
  //       included: false,
  //       not_included: false,
  //       pickup_drop_info: false,
  //       luggage_info: false,
  //       tour_operation_info: false,
  //       preparation_info: false,
  //       small_group_info: false,
  //       companion_info: false,
  //       exclusive_booking_info: false,
  //       cancellation_policy: false,
  //       chat_announcement: false,
  //       tags: false
  //     }
      
  //     const newUseCommonForField = {
  //       ...currentUseCommonForField,
  //       [field]: useCommon
  //     }
      
  //     // 모든 필드가 공통 사용인지 확인
  //     const allFieldsUseCommon = Object.values(newUseCommonForField).every(value => value === true)
      
  //     return {
  //       ...prev,
  //       useCommonForField: {
  //         ...prev.useCommonForField,
  //         [currentLang]: newUseCommonForField
  //       },
  //       // 모든 필드가 공통 사용이면 전체 공통 사용으로 설정
  //       useCommonDetails: allFieldsUseCommon
  //     }
  //   })
  // }


  // 번역 함수
  const translateCurrentLanguageDetails = async () => {
    const currentLang = formData.currentLanguage || 'ko'
    
    // 한국어가 아닌 경우 번역하지 않음
    if (currentLang !== 'ko') {
      setTranslationError(t('msgKoreanOnlyTranslate'))
      return
    }

    setTranslating(true)
    setTranslationError(null)

    try {
      const currentDetails = getCurrentLanguageDetails()
      
      // 번역할 필드들 수집
      const fieldsToTranslate: ProductDetailsTranslationFields = {
        slogan1: currentDetails.slogan1,
        slogan2: currentDetails.slogan2,
        slogan3: currentDetails.slogan3,
        description: currentDetails.description,
        included: currentDetails.included,
        not_included: currentDetails.not_included,
        pickup_drop_info: currentDetails.pickup_drop_info,
        luggage_info: currentDetails.luggage_info,
        tour_operation_info: currentDetails.tour_operation_info,
        preparation_info: currentDetails.preparation_info,
        small_group_info: currentDetails.small_group_info,
        notice_info: currentDetails.notice_info,
        private_tour_info: currentDetails.private_tour_info,
        cancellation_policy: currentDetails.cancellation_policy,
        chat_announcement: currentDetails.chat_announcement
      }

      // 번역 실행
      const result = await translateProductDetailsFields(fieldsToTranslate)

      if (result.success && result.translatedFields) {
        // 영어 언어가 없으면 생성
        if (!formData.productDetails.en) {
          setFormData(prev => ({
            ...prev,
            productDetails: {
              ...prev.productDetails,
              en: {
                slogan1: '',
                slogan2: '',
                slogan3: '',
                description: '',
                included: '',
                not_included: '',
                pickup_drop_info: '',
                luggage_info: '',
                tour_operation_info: '',
                preparation_info: '',
                small_group_info: '',
                notice_info: '',
                private_tour_info: '',
                cancellation_policy: '',
                chat_announcement: '',
                tags: []
              }
            }
          }))
        }

        // 번역된 내용을 영어 필드에 적용
        setFormData(prev => {
          if (!result.translatedFields) return prev
          return {
            ...prev,
            productDetails: {
              ...prev.productDetails,
              en: {
                ...prev.productDetails.en,
                ...result.translatedFields
              }
            }
          }
        })

        setSaveMessage(t('msgTranslateSuccess'))
        setSaveMessageType('success')
        setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
      } else {
        setTranslationError(result.error || t('msgTranslateFailed'))
      }
    } catch (error) {
      console.error('번역 오류:', error)
      setTranslationError(`${t('msgTranslateError')}: ${error instanceof Error ? error.message : ''}`)
    } finally {
      setTranslating(false)
    }
  }

  // ChatGPT 추천 함수
  const suggestDescription = async () => {
    setSuggesting(true)
    setSuggestionError(null)

    try {
      const productTitle = `투어 상품 (ID: ${productId})`
      const suggestedDescription = await suggestTourDescription(productTitle)
      
      // 현재 언어에 따라 적절한 필드에 적용
      const currentLang = formData.currentLanguage || 'ko'
      if (currentLang === 'ko') {
        setFormData(prev => ({
          ...prev,
          productDetails: {
            ...prev.productDetails,
            ko: {
              ...prev.productDetails.ko,
              description: suggestedDescription
            }
          }
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          productDetails: {
            ...prev.productDetails,
            [currentLang]: {
              ...prev.productDetails[currentLang as keyof typeof prev.productDetails],
              description: suggestedDescription
            }
          }
        }))
      }

      setSaveMessage(t('msgSuggestSuccess'))
      setSaveMessageType('success')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
    } catch (error) {
      console.error('ChatGPT 추천 오류:', error)
      setSuggestionError(error instanceof Error ? error.message : t('msgTranslateError'))
    } finally {
      setSuggesting(false)
    }
  }

  const handleSave = async (e?: React.MouseEvent) => {
    // 이벤트 전파 방지
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (isNewProduct) {
      setSaveMessage(t('msgNewProductUseFullSave'))
      setSaveMessageType('error')
      return
    }

    // 공통 세부정보 사용 시 개별 저장 차단
    if (formData.useCommonDetails) {
      setSaveMessage(t('msgCommonDetailsNoIndividualSave'))
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
      return
    }

    // AuthContext를 통한 인증 확인
    if (authLoading) {
      setSaveMessage(t('msgAuthChecking'))
      setSaveMessageType(null)
      return
    }

    if (!user) {
      setSaveMessage(t('msgLoginRequired'))
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      // 메인 페이지와 동일한 방식으로 저장
      console.log('product_details 저장 시작')
      console.log('AuthContext 사용자:', { email: user.email, id: user.id })
      
      // 각 언어별로 저장
      const currentLang = formData.currentLanguage || 'ko'
      const currentDetails = getCurrentLanguageDetails()
      
      const { data: existingDetails, error: selectDetailsError } = await supabase
        .from('product_details_multilingual')
        .select('id')
        .eq('product_id', productId)
        .eq('language_code', currentLang)
        .is('channel_id', null) // channel_id가 NULL인 경우만 조회
        .eq('variant_key', 'default') // variant_key가 'default'인 경우만 조회
        .maybeSingle() as { data: { id: string } | null, error: unknown }

      if (selectDetailsError) {
        console.error('product_details 존재 여부 확인 오류:', selectDetailsError)
        throw new Error(`상품 세부정보 조회 실패: ${String(selectDetailsError)}`)
      }

      // 빈 문자열을 null로 변환하는 헬퍼 함수
      // HTML 태그만 있는 빈 문자열도 처리
      const toNullIfEmpty = (value: string | null | undefined): string | null => {
        if (value === null || value === undefined) return null
        if (typeof value !== 'string') return null
        
        // HTML 태그 제거 후 trim
        const textContent = value.replace(/<[^>]*>/g, '').trim()
        if (textContent === '') return null
        
        return value
      }
      
      const detailsData = {
        product_id: productId,
        channel_id: null, // 채널 선택 없이 저장할 때는 NULL로 설정
        language_code: currentLang,
        variant_key: 'default', // 채널 선택 없이 저장할 때는 default variant 사용
        slogan1: toNullIfEmpty(currentDetails.slogan1),
        slogan2: toNullIfEmpty(currentDetails.slogan2),
        slogan3: toNullIfEmpty(currentDetails.slogan3),
        description: toNullIfEmpty(currentDetails.description),
        included: toNullIfEmpty(currentDetails.included),
        not_included: toNullIfEmpty(currentDetails.not_included),
        pickup_drop_info: toNullIfEmpty(currentDetails.pickup_drop_info),
        luggage_info: toNullIfEmpty(currentDetails.luggage_info),
        tour_operation_info: toNullIfEmpty(currentDetails.tour_operation_info),
        preparation_info: toNullIfEmpty(currentDetails.preparation_info),
        small_group_info: toNullIfEmpty(currentDetails.small_group_info),
        notice_info: toNullIfEmpty(currentDetails.notice_info),
        private_tour_info: toNullIfEmpty(currentDetails.private_tour_info),
        cancellation_policy: toNullIfEmpty(currentDetails.cancellation_policy),
        chat_announcement: toNullIfEmpty(currentDetails.chat_announcement),
        tags: currentDetails.tags ?? null
      }
      
      console.log('저장할 상세 정보:', {
        private_tour_info: detailsData.private_tour_info,
        private_tour_info_type: typeof detailsData.private_tour_info,
        private_tour_info_length: detailsData.private_tour_info?.length,
        original_private_tour_info: currentDetails.private_tour_info,
        original_type: typeof currentDetails.private_tour_info,
        original_length: currentDetails.private_tour_info?.length,
        formData_productDetails: formData.productDetails?.[currentLang]?.private_tour_info,
        formData_type: typeof formData.productDetails?.[currentLang]?.private_tour_info,
        formData_length: formData.productDetails?.[currentLang]?.private_tour_info?.length,
        allFields: detailsData
      })

      if (existingDetails) {
        // 업데이트
        const { error: detailsError } = await supabase
          .from('product_details_multilingual')
          .update({
            ...detailsData,
            updated_at: new Date().toISOString()
          })
          .eq('product_id', productId)
          .eq('language_code', currentLang)
          .is('channel_id', null) // channel_id가 NULL인 경우만 업데이트
          .eq('variant_key', 'default') // variant_key가 'default'인 경우만 업데이트

        if (detailsError) {
          console.error('product_details 업데이트 오류:', detailsError)
          throw new Error(`상품 세부정보 업데이트 실패: ${detailsError.message}`)
        }
        console.log('product_details 업데이트 완료')
        
        // 업데이트 후 실제 저장된 값 확인
        const { data: savedData, error: verifyError } = await supabase
          .from('product_details_multilingual')
          .select('private_tour_info, chat_announcement')
          .eq('product_id', productId)
          .eq('language_code', currentLang)
          .is('channel_id', null)
          .eq('variant_key', 'default')
          .maybeSingle() as { data: { private_tour_info: string | null; chat_announcement: string | null } | null; error: unknown }
        
        if (!verifyError && savedData) {
          console.log('일반 세부정보 저장 후 확인:', {
            private_tour_info: savedData.private_tour_info,
            private_tour_info_length: savedData.private_tour_info?.length,
            chat_announcement: savedData.chat_announcement,
            chat_announcement_length: savedData.chat_announcement?.length
          })
        }
      } else {
        // 새로 생성
        const { error: detailsError } = await supabase
          .from('product_details_multilingual')
          .insert([detailsData])

        if (detailsError) {
          console.error('product_details 생성 오류:', detailsError)
          throw new Error(`상품 세부정보 생성 실패: ${detailsError.message}`)
        }
        console.log('product_details 생성 완료')
        
        // 저장 후 실제 저장된 값 확인
        const { data: savedData, error: verifyError } = await supabase
          .from('product_details_multilingual')
          .select('private_tour_info, chat_announcement')
          .eq('product_id', productId)
          .eq('language_code', currentLang)
          .is('channel_id', null)
          .eq('variant_key', 'default')
          .maybeSingle() as { data: { private_tour_info: string | null; chat_announcement: string | null } | null; error: unknown }
        
        if (!verifyError && savedData) {
          console.log('일반 세부정보 저장 후 확인 (신규 생성):', {
            private_tour_info: savedData.private_tour_info,
            private_tour_info_length: savedData.private_tour_info?.length,
            chat_announcement: savedData.chat_announcement,
            chat_announcement_length: savedData.chat_announcement?.length
          })
        }
      }

      setSaveMessage(t('msgDetailsSaveSuccess'))
      setSaveMessageType('success')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
    } catch (error: unknown) {
      const e = error as { message?: string; status?: string | number; code?: string }
      const errorMessage = e?.message || ''
      const status = e?.status ?? e?.code ?? 'unknown'
      console.error('상품 세부정보 저장 오류:', { status, error: e })
      setSaveMessage(`${t('msgDetailsSaveError')} [${String(status)}] ${errorMessage}`)
      setSaveMessageType('error')
      setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 5000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* 새로운 채널별 세부정보 관리 UI */}
      <div className="bg-white border border-gray-200 rounded-lg">
        {/* 헤더 */}
        <div className="border-b border-gray-200 p-2 md:p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
              <h3 className="text-sm font-medium text-gray-900 flex items-center">
                <Users className="h-3.5 w-3.5 mr-2" />
                {t('channelDetailsTitle')}
              </h3>
              {/* 언어 선택 스위치 */}
              <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <Languages className="h-3 w-3 text-gray-500 flex-shrink-0" />
                <div className="flex space-x-1 bg-gray-100 p-0.5 rounded-lg min-w-max">
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleLanguageChange(lang)}
                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                        (formData.currentLanguage || 'ko') === lang
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {lang === 'ko' ? t('langKorean') :
                       lang === 'en' ? t('langEnglish') :
                       lang === 'ja' ? t('langJapanese') :
                       lang === 'zh' ? t('langChinese') : lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
              {/* 번역 버튼 */}
              <button
                type="button"
                onClick={translateCurrentLanguageDetails}
                disabled={translating || (formData.currentLanguage || 'ko') !== 'ko'}
                className="flex-1 sm:flex-none flex items-center justify-center px-2 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-[11px]"
                title={t('translateTitle')}
              >
                {translating ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Languages className="h-3 w-3 mr-1" />
                )}
                {translating ? t('translateLoading') : t('translate')}
              </button>
              {/* AI 추천 버튼 */}
              <button
                type="button"
                onClick={suggestDescription}
                disabled={suggesting}
                className="flex-1 sm:flex-none flex items-center justify-center px-2 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-[11px]"
                title={t('aiSuggestTitle')}
              >
                {suggesting ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                {suggesting ? t('aiSuggestLoading') : t('aiSuggest')}
              </button>
              {/* 새로고침 버튼 */}
              <button
                onClick={() => loadSelectedChannelData()}
                disabled={loadingChannelData}
                className="flex-1 sm:flex-none flex items-center justify-center px-2 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-[11px]"
              >
                {loadingChannelData ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <FileText className="h-3 w-3 mr-1" />
                )}
                {t('refresh')}
              </button>
            </div>
          </div>
        </div>

        {/* 좌우 분할 레이아웃 (모바일에서는 상하 배치) */}
        <div className="flex flex-col lg:flex-row lg:h-[800px]">
          {/* 왼쪽: 채널 선택 및 공통 세부정보 (모바일에서는 상단) */}
          <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-gray-200 p-4 overflow-y-auto max-h-[400px] lg:max-h-full">
            <div className="space-y-6">
              {/* 공통 세부정보 섹션 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  {t('commonDetailsTitle')}
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{t('useCommonDetails')}</span>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.useCommonDetails}
                        onChange={(e) => setFormData(prev => ({ ...prev, useCommonDetails: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">카테고리</span>
                    <span className="text-sm font-medium text-gray-900">{subCategory}</span>
                  </div>
                  
                  <button
                    onClick={() => setIsCommonModalOpen(true)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    공통 세부정보 관리
                  </button>
                </div>
              </div>

              {/* 채널 선택 섹션 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{t('channelSelect')}</h4>
                  <span className="text-sm text-gray-500">
                    {(() => {
                      const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
                      const selectedChannelsData = selectedChannelIds.map(id => {
                        const channel = channels.find(c => c.id === id)
                        return { id, type: channel?.type || 'unknown' }
                      })
                      const selfChannels = selectedChannelsData.filter(c => c.type === 'self' || c.type === 'SELF')
                      const otaChannels = selectedChannelsData.filter(c => c.type !== 'self' && c.type !== 'SELF')
                      
                      const parts: string[] = []
                      if (selfChannels.length > 0) {
                        parts.push(t('selfGroupSelected'))
                      }
                      if (otaChannels.length > 0) {
                        parts.push(t('otaCountSelected', { count: otaChannels.length }))
                      }
                      return parts.length > 0 ? parts.join(', ') + t('selectedSuffix') : t('selectedCount', { count: 0 })
                    })()}
                  </span>
                </div>

                {/* 완성도 필터 */}
                <div className="mb-3 flex space-x-2">
                  <button
                    onClick={() => setCompletionFilter('all')}
                    className={`px-2 py-1 text-xs rounded ${
                      completionFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('filterAll')}
                  </button>
                  <button
                    onClick={() => setCompletionFilter('incomplete')}
                    className={`px-2 py-1 text-xs rounded ${
                      completionFilter === 'incomplete'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('filterIncomplete')}
                  </button>
                  <button
                    onClick={() => setCompletionFilter('empty')}
                    className={`px-2 py-1 text-xs rounded ${
                      completionFilter === 'empty'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('filterEmpty')}
                  </button>
                </div>


              {/* 채널 그룹들 */}
              {channelGroups.map((group) => {
                const isSelfGroup = group.type === 'self' || group.type === 'SELF'
                const selectedChannelsInGroup = group.channels.filter(channel => selectedChannels[channel.id])
                const allSelected = group.channels.every(channel => selectedChannels[channel.id])
                const someSelected = selectedChannelsInGroup.length > 0 && !allSelected
                
                return (
                  <div key={group.type} className="border border-gray-200 rounded-lg">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleGroupExpansion(group.type)}
                    >
                      <div className="flex items-center space-x-2">
                        {expandedGroups[group.type] ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="font-medium text-gray-900">
                          {isSelfGroup ? t('selfGroupLabel') : group.type}
                        </span>
                        <span className="text-sm text-gray-500">({group.channels.length})</span>
                        {isSelfGroup && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {t('singleDetailsShare')}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleGroupSelection(group.type)
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                        title={isSelfGroup ? t('selfGroupSelectAllTitle') : t('groupSelectAllTitle')}
                      >
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : someSelected ? (
                          <div className="h-4 w-4 border-2 border-blue-600 bg-blue-100 rounded" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    
                    {expandedGroups[group.type] && (
                      <div className="border-t border-gray-200 p-2 space-y-1">
                        {isSelfGroup && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                            <p className="text-xs text-blue-700">
                              ℹ️ {t('selfGroupHint')}
                            </p>
                          </div>
                        )}
                        {group.channels.map((channel) => {
                          // 채널 통계 포맷팅 함수
                          const formatPricingStats = (stats: Record<string, number> | undefined) => {
                            if (!stats || Object.keys(stats).length === 0) return null;
                            
                            const sortedYears = Object.keys(stats).sort();
                            return sortedYears.map(year => {
                              const daysCount = stats[year];
                              const isLeapYear = (parseInt(year) % 4 === 0 && parseInt(year) % 100 !== 0) || (parseInt(year) % 400 === 0);
                              const totalDays = isLeapYear ? 366 : 365;
                              return `${year} (${daysCount}/${totalDays})`;
                            }).join(', ');
                          };

                          // 채널 ID로 먼저 찾고, 없으면 채널 이름으로 찾기
                          let stats = channelPricingStats[channel.id];
                          if (!stats || Object.keys(stats).length === 0) {
                            // ID로 찾지 못하면 이름으로 찾기
                            stats = channelPricingStats[channel.name];
                          }
                          const statsText = formatPricingStats(stats);

                          // 완성도 정보
                          const completion = channelCompletionStats[channel.id]
                          const completionPercentage = completion?.percentage ?? 0
                          const completionColor = completionPercentage === 0 
                            ? 'bg-red-100 text-red-700 border-red-300' 
                            : completionPercentage < 50 
                            ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                            : completionPercentage < 100
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-green-100 text-green-700 border-green-300'

                          const isSelected = selectedChannels[channel.id] || false
                          const variants = productVariantsByChannel[channel.id] || []
                          const selectedVariant = channelVariants[channel.id] || 'default'
                          
                          // 필터링: 완성도 필터 적용
                          if (completionFilter === 'empty' && completionPercentage > 0) return null
                          if (completionFilter === 'incomplete' && completionPercentage === 100) return null
                          
                          return (
                            <div key={channel.id} className="space-y-1">
                              <label
                                className={`flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer ${
                                  completionPercentage === 0 ? 'border-l-4 border-red-500 bg-red-50' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleChannelSelection(channel.id)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="flex flex-col flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-700">{channel.name}</span>
                                  {completion && (
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium border ${completionColor}`}>
                                      {completion.completed}/{completion.total} ({completion.percentage}%)
                                    </span>
                                  )}
                                </div>
                                {statsText && (
                                  <span className="text-xs text-gray-500 mt-0.5">{statsText}</span>
                                )}
                                {completion && completion.missingFields.length > 0 && (
                                  <span className="text-xs text-gray-400 mt-0.5">
                                    {t('missingLabel')} {completion.missingFields.slice(0, 3).join(', ')}
                                    {completion.missingFields.length > 3 && ` ${t('missingMore', { count: completion.missingFields.length - 3 })}`}
                                  </span>
                                )}
                              </div>
                              {isSelfGroup && selectedChannels[channel.id] && (
                                <span className="text-xs text-blue-600">({t('groupLabel')})</span>
                              )}
                            </label>
                            
                            {/* Variant 선택 (채널이 선택되었을 때만 표시) */}
                            {isSelected && variants.length > 0 && (
                              <div className="ml-6 mb-2">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Variant
                                </label>
                                <select
                                  value={selectedVariant}
                                  onChange={async (e) => {
                                    const newVariantKey = e.target.value
                                    // Variant 상태 업데이트
                                    setChannelVariants(prev => ({
                                      ...prev,
                                      [channel.id]: newVariantKey
                                    }))
                                    // Variant 변경 시 해당 variant의 데이터 즉시 로드
                                    // 상태 업데이트를 기다리지 않고 직접 variant 값을 사용하여 로드
                                    const updatedVariants = {
                                      ...channelVariants,
                                      [channel.id]: newVariantKey
                                    }
                                    // 업데이트된 variant 값을 직접 전달하여 즉시 데이터 로드
                                    await loadSelectedChannelData(updatedVariants)
                                  }}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  {variants.map((variant) => (
                                    <option key={variant.variant_key} value={variant.variant_key}>
                                      {variant.variant_name_ko || variant.variant_name_en || variant.variant_key}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
            </div>
          </div>

          {/* 오른쪽: 입력 섹션 (모바일에서는 하단) */}
          <div className="flex-1 p-2 md:p-4 overflow-y-auto">
            {Object.keys(selectedChannels).filter(id => selectedChannels[id]).length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">{t('selectChannelPrompt')}</p>
                  <p className="text-sm mt-1">{t('selectChannelHint')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    {t('saveToChannelsHint', { count: Object.keys(selectedChannels).filter(id => selectedChannels[id]).length })}
                  </p>
                </div>

                {/* 기존 입력 폼들 - 여기에 기존의 모든 입력 필드들이 들어갑니다 */}
                {/* 슬로건 섹션 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-900">{t('slogan')}</h4>
                    <button
                      onClick={() => openCopyModal('slogan')}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      title={t('copyToChannels')}
                    >
                      <Copy className="h-3 w-3" />
                      <span>{t('copy')}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {tDetails('slogan1')}
                      </label>
                      <input
                        type="text"
                        value={getValue('slogan1', true)}
                        onChange={(e) => handleInputChange('slogan1', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={tDetails('placeholderSlogan1')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {tDetails('slogan2')}
                      </label>
                      <input
                        type="text"
                        value={getValue('slogan2', true)}
                        onChange={(e) => handleInputChange('slogan2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={tDetails('placeholderSlogan2')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {tDetails('slogan3')}
                      </label>
                      <input
                        type="text"
                        value={getValue('slogan3', true)}
                        onChange={(e) => handleInputChange('slogan3', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={tDetails('placeholderSlogan3')}
                      />
                    </div>
                  </div>
                </div>

                {/* 상품 설명 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">{tDetails('description')}</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('detailDescription')}
                    </label>
                    <LightRichEditor
                      value={getValue('description', true) as string}
                      onChange={(value) => handleInputChange('description', value || '')}
                      height={150}
                      placeholder={tDetails('placeholderDescription')}
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 포함/불포함 정보 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-900">포함/불포함 정보</h4>
                    <button
                      onClick={() => openCopyModal('included_not_included')}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      title="포함/불포함 정보를 다른 채널에 복사"
                    >
                      <Copy className="h-3 w-3" />
                      <span>복사</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        포함 사항
                      </label>
                      <LightRichEditor
                        value={getValue('included', true) as string}
                        onChange={(value) => handleInputChange('included', value || '')}
                        height={150}
                        placeholder="포함되는 사항들을 입력해주세요"
                        enableResize={true}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {tDetails('notIncluded')}
                      </label>
                      <LightRichEditor
                        value={getValue('not_included', true) as string}
                        onChange={(value) => handleInputChange('not_included', value || '')}
                        height={150}
                        placeholder={tDetails('placeholderNotIncluded')}
                        enableResize={true}
                      />
                    </div>
                  </div>
                </div>

                {/* 픽업/드롭 정보 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-900">{t('pickupDropInfo')}</h4>
                    <button
                      onClick={() => openCopyModal('pickup_drop_info')}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      title={t('copyToChannels')}
                    >
                      <Copy className="h-3 w-3" />
                      <span>{t('copy')}</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {tDetails('pickupDropInfo')}
                    </label>
                    <LightRichEditor
                      value={getValue('pickup_drop_info', true) as string}
                      onChange={(value) => handleInputChange('pickup_drop_info', value || '')}
                      height={120}
                      placeholder={tDetails('placeholderPickupDrop')}
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 수하물 정보 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">{t('luggageInfo')}</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {tDetails('luggageInfo')}
                    </label>
                    <LightRichEditor
                      value={getValue('luggage_info', true) as string}
                      onChange={(value) => handleInputChange('luggage_info', value || '')}
                      height={120}
                      placeholder={tDetails('placeholderLuggage')}
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 투어 운영 정보 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-900">투어 운영 정보</h4>
                    <button
                      onClick={() => openCopyModal('tour_operation_info')}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      title="투어 운영 정보를 다른 채널에 복사"
                    >
                      <Copy className="h-3 w-3" />
                      <span>복사</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      투어 운영 관련 정보
                    </label>
                    <LightRichEditor
                      value={getValue('tour_operation_info', true) as string}
                      onChange={(value) => handleInputChange('tour_operation_info', value || '')}
                      height={120}
                      placeholder="투어 운영에 대한 정보를 입력해주세요"
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 준비 사항 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">{t('preparationInfo')}</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {tDetails('preparationInfo')}
                    </label>
                    <LightRichEditor
                      value={getValue('preparation_info', true) as string}
                      onChange={(value) => handleInputChange('preparation_info', value || '')}
                      height={120}
                      placeholder={tDetails('placeholderPreparation')}
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 소그룹 정보 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-900">{t('smallGroupInfo')}</h4>
                    <button
                      onClick={() => openCopyModal('small_group_info')}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      title={t('copyToChannels')}
                    >
                      <Copy className="h-3 w-3" />
                      <span>{t('copy')}</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {tDetails('smallGroupInfo')}
                    </label>
                    <LightRichEditor
                      value={getValue('small_group_info', true) as string}
                      onChange={(value) => handleInputChange('small_group_info', value || '')}
                      height={120}
                      placeholder={tDetails('placeholderSmallGroup')}
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 안내사항 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">{tDetails('noticeInfo')}</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {tDetails('noticeInfo')}
                    </label>
                    <LightRichEditor
                      value={getValue('notice_info', true) as string}
                      onChange={(value) => handleInputChange('notice_info', value || '')}
                      height={120}
                      placeholder={tDetails('placeholderNotice')}
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 단독투어 정보 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-900">{tDetails('privateTourInfo')}</h4>
                    <button
                      onClick={() => openCopyModal('private_tour_info')}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      title={t('copyToChannels')}
                    >
                      <Copy className="h-3 w-3" />
                      <span>{t('copy')}</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {tDetails('privateTourInfo')}
                    </label>
                    <LightRichEditor
                      value={getValue('private_tour_info', true) as string}
                      onChange={(value) => {
                        const processedValue = value == null ? '' : (typeof value === 'string' ? value : String(value))
                        handleInputChange('private_tour_info', processedValue)
                      }}
                      height={120}
                      placeholder={tDetails('placeholderPrivateTour')}
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 취소 정책 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">{tDetails('cancellationPolicy')}</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {tDetails('cancellationPolicy')}
                    </label>
                    <LightRichEditor
                      value={getValue('cancellation_policy', true) as string}
                      onChange={(value) => handleInputChange('cancellation_policy', value || '')}
                      height={150}
                      placeholder={tDetails('placeholderCancellation')}
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 채팅 공지 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-900">{tDetails('sectionChatAnnouncement')}</h4>
                    <button
                      onClick={() => openCopyModal('chat_announcement')}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      title={t('copyToChannels')}
                    >
                      <Copy className="h-3 w-3" />
                      <span>{t('copy')}</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {tDetails('chatAnnouncementLabel')}
                    </label>
                    <LightRichEditor
                      value={getValue('chat_announcement', true) as string}
                      onChange={(value) => {
                        const processedValue = value == null ? '' : (typeof value === 'string' ? value : String(value))
                        handleInputChange('chat_announcement', processedValue)
                      }}
                      height={120}
                      placeholder={tDetails('placeholderChatAnnouncement')}
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 채널별 저장 버튼 - 입력 폼 하단 */}
                <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
                  <button
                    onClick={saveSelectedChannelsDetails}
                    disabled={saving || Object.keys(selectedChannels).filter(id => selectedChannels[id]).length === 0}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? t('saveLoading') : t('saveSelectedChannels')}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* 번역 오류 메시지 */}
      {translationError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{translationError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={() => setTranslationError(null)}
                className="inline-flex text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ChatGPT 추천 오류 메시지 */}
      {suggestionError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{suggestionError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={() => setSuggestionError(null)}
                className="inline-flex text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 버튼 및 메시지 - 채널별 세부정보 관리 섹션이 없을 때만 표시 */}
      {Object.keys(selectedChannels).filter(id => selectedChannels[id]).length === 0 && (
        <div className="flex justify-between items-center">
          <div></div>
          <div className="flex items-center space-x-4">
            {saveMessage && (
              <div className={`flex items-center text-sm ${
                saveMessageType === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                <AlertCircle className="h-4 w-4 mr-1" />
                {saveMessage}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => handleSave(e)}
              disabled={saving || isNewProduct || formData.useCommonDetails}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('saveLoading') : t('save')}
            </button>
          </div>
        </div>
      )}
      
      {/* 채널 선택 시 메시지만 표시하는 영역 */}
      {Object.keys(selectedChannels).filter(id => selectedChannels[id]).length > 0 && (
        <div className="flex justify-between items-center">
          <div></div>
          <div className="flex items-center space-x-4">
            {saveMessage && (
              <div className={`flex items-center text-sm ${
                saveMessageType === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                <AlertCircle className="h-4 w-4 mr-1" />
                {saveMessage}
              </div>
            )}
          </div>
        </div>
      )}

      <CommonDetailsModal
        isOpen={isCommonModalOpen}
        onClose={() => setIsCommonModalOpen(false)}
        subCategory={subCategory}
        onSave={() => {
          // 공통 세부정보가 저장되면 프리뷰를 다시 로드
          loadCommon()
        }}
      />

      {/* 복사 모달 */}
      {copyModalOpen && copyFieldName && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {getCopyFieldLabel(copyFieldName)} - {t('copyToChannels')}
              </h3>
              <button
                onClick={() => {
                  setCopyModalOpen(false)
                  setCopyTargetChannels({})
                  setCopyFieldName(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              {t('copyModalIntro')}
            </p>

            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {channelGroups.map((group) => (
                <div key={group.type} className="border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-gray-900 mb-2">
                    {group.type === 'self' || group.type === 'SELF' ? t('selfGroupLabel') : group.type}
                  </div>
                  <div className="space-y-2">
                    {group.channels.map((channel) => {
                      const isSelected = selectedChannels[channel.id]
                      if (isSelected) return null // 이미 선택된 채널은 제외
                      
                      return (
                        <label key={channel.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={copyTargetChannels[channel.id] || false}
                            onChange={(e) => {
                              setCopyTargetChannels(prev => ({
                                ...prev,
                                [channel.id]: e.target.checked
                              }))
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{channel.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setCopyModalOpen(false)
                  setCopyTargetChannels({})
                  setCopyFieldName(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  const selectedTargetIds = Object.keys(copyTargetChannels).filter(id => copyTargetChannels[id])
                  if (selectedTargetIds.length === 0) {
                    setSaveMessage(t('msgSelectChannelsToCopy'))
                    setSaveMessageType('error')
                    setTimeout(() => { setSaveMessage(''); setSaveMessageType(null) }, 3000)
                    return
                  }
                  copyFieldToChannels(copyFieldName, selectedTargetIds)
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {t('copyExecute')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
