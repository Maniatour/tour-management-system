'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  // formData는 props로 받아서 사용

  const [saving, setSaving] = useState(false)
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
  const [copyFromChannel, setCopyFromChannel] = useState<string | null>(null)
  const [channelPricingStats, setChannelPricingStats] = useState<Record<string, Record<string, number>>>({})

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
        data = fallbackData;
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
  const loadSelectedChannelData = useCallback(async () => {
    const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
    if (selectedChannelIds.length === 0) {
      // 채널이 선택되지 않았으면 일반 데이터 로드 (loadProductDetails는 나중에 호출)
      return
    }

    setLoadingChannelData(true)
    try {
      // self 채널과 OTA 채널을 분리
      const selectedChannelsData = selectedChannelIds.map(id => {
        const channel = channels.find(c => c.id === id)
        return { id, type: channel?.type || 'unknown' }
      })

      const selfChannels = selectedChannelsData.filter(c => c.type === 'self' || c.type === 'SELF')
      const otaChannels = selectedChannelsData.filter(c => c.type !== 'self' && c.type !== 'SELF')

      // 조회할 channel_id 목록 생성
      const channelIdsToQuery: string[] = []
      
      // self 채널이 선택된 경우 'SELF_GROUP' 추가
      if (selfChannels.length > 0) {
        channelIdsToQuery.push('SELF_GROUP')
      }
      
      // OTA 채널들의 개별 ID 추가
      otaChannels.forEach(channel => {
        channelIdsToQuery.push(channel.id)
      })

      if (channelIdsToQuery.length === 0) {
        setLoadingChannelData(false)
        return
      }

      const { data, error } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .in('channel_id', channelIdsToQuery) as {
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

      if (error) throw error

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
  }, [selectedChannels, productId, supabase, setFormData, channels])

  // 채널 선택 토글
  const toggleChannelSelection = (channelId: string) => {
    setSelectedChannels(prev => ({
      ...prev,
      [channelId]: !prev[channelId]
    }))
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

  // 채널 간 복사
  const copyChannelData = async (fromChannelId: string, toChannelIds: string[]) => {
    if (!fromChannelId || toChannelIds.length === 0) return

    try {
      // fromChannelId가 'SELF_GROUP'인 경우 실제 channel_id로 변환
      const actualFromChannelId = fromChannelId === 'SELF_GROUP' ? 'SELF_GROUP' : fromChannelId
      
      const { data: sourceData, error: fetchError } = await supabase
        .from('product_details_multilingual')
        .select('*')
        .eq('product_id', productId)
        .eq('channel_id', actualFromChannelId)

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
          for (const sourceItem of sourceData as Array<{
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
          }>) {
            const copyData = {
              product_id: productId,
              channel_id: group.channelId, // self 채널은 'SELF_GROUP', OTA는 개별 channel_id
              language_code: sourceItem.language_code,
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
              .maybeSingle()

            if (selectError && selectError.code !== 'PGRST116') {
              console.error(`채널 그룹 ${group.channelId} 데이터 확인 오류:`, selectError)
              throw selectError
            }

            if (existingData) {
              // 업데이트
              const { error: updateError } = await supabase
                .from('product_details_multilingual')
                // @ts-expect-error - Supabase 타입 추론 문제
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
                // @ts-expect-error - Supabase 타입 추론 문제
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
        
        setSaveMessage(`${toChannelIds.length}개 채널에 데이터가 복사되었습니다!`)
        setTimeout(() => setSaveMessage(''), 3000)
      }
    } catch (error) {
      console.error('채널 데이터 복사 오류:', error)
      
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
      
      setSaveMessage(`채널 데이터 복사 중 오류가 발생했습니다: ${errorMessage}`)
      setTimeout(() => setSaveMessage(''), 5000)
    }
  }

  // 선택된 채널들에 세부 정보 저장
  const saveSelectedChannelsDetails = async () => {
    const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
    if (selectedChannelIds.length === 0) {
      setSaveMessage('저장할 채널을 선택해주세요.')
      setTimeout(() => setSaveMessage(''), 3000)
      return
    }

    setSaving(true)
    setSaveMessage('')

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
        
        const detailsData = {
          product_id: productId,
          channel_id: group.channelId, // self 채널은 'SELF_GROUP', OTA는 개별 channel_id
          language_code: currentLang,
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

        // 기존 데이터 확인 (product_id, channel_id, language_code 조합으로)
        const { data: existingData, error: selectError } = await supabase
          .from('product_details_multilingual')
          .select('id')
          .eq('product_id', productId)
          .eq('channel_id', group.channelId)
          .eq('language_code', currentLang)
          .maybeSingle()

        if (selectError && selectError.code !== 'PGRST116') {
          console.error(`채널 그룹 ${channelIdLabel} 데이터 확인 오류:`, selectError)
          throw selectError
        }

        if (existingData) {
          // 업데이트
          const { error: updateError } = await supabase
            .from('product_details_multilingual')
            // @ts-expect-error - Supabase 타입 추론 문제
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
            // @ts-expect-error - Supabase 타입 추론 문제
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
                .maybeSingle()

              if (findError && findError.code !== 'PGRST116') {
                console.error(`채널 그룹 ${channelIdLabel} 생성 오류 (중복 키 후 재확인 실패):`, findError)
                throw new Error(`채널 그룹 ${channelIdLabel} 생성 실패: ${insertError.message}`)
              }

              if (existingRecord) {
                const { error: updateError } = await supabase
                  .from('product_details_multilingual')
                  // @ts-expect-error - Supabase 타입 추론 문제
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
        detailsData = commonData
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

  // 채널 목록이 로드된 후 통계 로드
  useEffect(() => {
    if (channels.length > 0 && !isNewProduct && productId) {
      loadChannelPricingStats()
    }
  }, [channels.length, isNewProduct, productId, loadChannelPricingStats])

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
      setTranslationError('한국어 내용만 번역할 수 있습니다.')
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

        setSaveMessage('번역이 완료되었습니다! 영어 탭에서 확인하세요.')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setTranslationError(result.error || '번역에 실패했습니다.')
      }
    } catch (error) {
      console.error('번역 오류:', error)
      setTranslationError(`번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
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

      setSaveMessage('ChatGPT 추천 설명이 적용되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('ChatGPT 추천 오류:', error)
      setSuggestionError(error instanceof Error ? error.message : 'ChatGPT 추천 중 오류가 발생했습니다.')
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
      setSaveMessage('새 상품은 전체 저장을 사용해주세요.')
      return
    }

    // 공통 세부정보 사용 시 개별 저장 차단
    if (formData.useCommonDetails) {
      setSaveMessage('공통 세부정보 사용 중입니다. 개별 저장은 비활성화됩니다.')
      setTimeout(() => setSaveMessage(''), 3000)
      return
    }

    // AuthContext를 통한 인증 확인
    if (authLoading) {
      setSaveMessage('인증 상태를 확인하는 중입니다...')
      return
    }

    if (!user) {
      setSaveMessage('로그인이 필요합니다. 페이지를 새로고침 후 다시 시도해주세요.')
      setTimeout(() => setSaveMessage(''), 5000)
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
          // @ts-expect-error - Supabase 타입 추론 문제
          .update({
            ...detailsData,
            updated_at: new Date().toISOString()
          })
          .eq('product_id', productId)
          .eq('language_code', currentLang)
          .is('channel_id', null) // channel_id가 NULL인 경우만 업데이트

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
          // @ts-expect-error - Supabase 타입 추론 문제
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

      setSaveMessage('상품 세부정보가 성공적으로 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error: unknown) {
      const e = error as { message?: string; status?: string | number; code?: string }
      const errorMessage = e?.message || '알 수 없는 오류가 발생했습니다.'
      const status = e?.status || e?.code || 'unknown'
      console.error('상품 세부정보 저장 오류:', { status, error: e })
      setSaveMessage(`저장에 실패했습니다: [${String(status)}] ${errorMessage}`)
      setTimeout(() => setSaveMessage(''), 5000)
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
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                채널별 세부정보 관리
              </h3>
              {/* 언어 선택 스위치 */}
              <div className="flex items-center space-x-2">
                <Languages className="h-4 w-4 text-gray-500" />
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleLanguageChange(lang)}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        (formData.currentLanguage || 'ko') === lang
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {lang === 'ko' ? '한국어' : 
                       lang === 'en' ? 'English' : 
                       lang === 'ja' ? '日本語' : 
                       lang === 'zh' ? '中文' : lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* 번역 버튼 */}
              <button
                type="button"
                onClick={translateCurrentLanguageDetails}
                disabled={translating || (formData.currentLanguage || 'ko') !== 'ko'}
                className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                title="한국어 내용을 영어로 번역"
              >
                {translating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Languages className="h-4 w-4 mr-1" />
                )}
                {translating ? '번역 중...' : '번역'}
              </button>
              {/* AI 추천 버튼 */}
              <button
                type="button"
                onClick={suggestDescription}
                disabled={suggesting}
                className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                title="ChatGPT로 설명 추천받기"
              >
                {suggesting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                {suggesting ? '추천 중...' : 'AI 추천'}
              </button>
              {/* 새로고침 버튼 */}
              <button
                onClick={loadSelectedChannelData}
                disabled={loadingChannelData}
                className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                {loadingChannelData ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-1" />
                )}
                새로고침
              </button>
            </div>
          </div>
        </div>

        {/* 좌우 분할 레이아웃 */}
        <div className="flex h-[800px]">
          {/* 왼쪽: 채널 선택 및 공통 세부정보 */}
          <div className="w-1/3 border-r border-gray-200 p-4 overflow-y-auto">
            <div className="space-y-6">
              {/* 공통 세부정보 섹션 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  공통 세부정보 관리
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">공통 세부정보 사용</span>
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
                  <h4 className="font-medium text-gray-900">채널 선택</h4>
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
                        parts.push('self 그룹')
                      }
                      if (otaChannels.length > 0) {
                        parts.push(`OTA ${otaChannels.length}개`)
                      }
                      return parts.length > 0 ? parts.join(', ') : '0개'
                    })()} 선택됨
                  </span>
                </div>

              {/* 복사 기능 */}
              {(() => {
                const selectedChannelIds = Object.keys(selectedChannels).filter(id => selectedChannels[id])
                if (selectedChannelIds.length === 0) return null
                
                // self 채널과 OTA 채널을 분리
                const selectedChannelsData = selectedChannelIds.map(id => {
                  const channel = channels.find(c => c.id === id)
                  return { id, type: channel?.type || 'unknown', channel }
                })
                const selfChannels = selectedChannelsData.filter(c => c.type === 'self' || c.type === 'SELF')
                const otaChannels = selectedChannelsData.filter(c => c.type !== 'self' && c.type !== 'SELF')
                
                // 복사 가능한 소스 목록 생성
                const copySources: Array<{ id: string, label: string, isSelfGroup: boolean }> = []
                if (selfChannels.length > 0) {
                  copySources.push({ id: 'SELF_GROUP', label: 'self 그룹', isSelfGroup: true })
                }
                otaChannels.forEach(ch => {
                  copySources.push({ 
                    id: ch.id, 
                    label: `${ch.channel?.name || ch.id} (${ch.type})`, 
                    isSelfGroup: false 
                  })
                })
                
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Copy className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">채널 간 복사</span>
                    </div>
                    <div className="space-y-2">
                      <select
                        value={copyFromChannel || ''}
                        onChange={(e) => setCopyFromChannel(e.target.value || null)}
                        className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">복사할 채널/그룹 선택</option>
                        {copySources.map(source => (
                          <option key={source.id} value={source.id}>
                            {source.label}
                          </option>
                        ))}
                      </select>
                      {copyFromChannel && (
                        <button
                          onClick={() => {
                            // 복사 대상 채널 목록 생성
                            const toChannels: string[] = []
                            
                            if (copyFromChannel === 'SELF_GROUP') {
                              // self 그룹에서 복사: self 채널들을 제외한 모든 선택된 채널에 복사
                              toChannels.push(...otaChannels.map(c => c.id))
                            } else {
                              // 개별 채널에서 복사: 복사 소스를 제외한 모든 선택된 채널에 복사
                              const fromChannel = channels.find(c => c.id === copyFromChannel)
                              const isFromSelf = fromChannel?.type === 'self' || fromChannel?.type === 'SELF'
                              
                              if (isFromSelf) {
                                // self 채널에서 복사: OTA 채널들에 복사
                                toChannels.push(...otaChannels.map(c => c.id))
                              } else {
                                // OTA 채널에서 복사: 복사 소스를 제외한 모든 채널에 복사
                                toChannels.push(...selectedChannelIds.filter(id => id !== copyFromChannel))
                              }
                            }
                            
                            if (toChannels.length > 0) {
                              copyChannelData(copyFromChannel, toChannels)
                            } else {
                              setSaveMessage('복사할 대상 채널이 없습니다.')
                              setTimeout(() => setSaveMessage(''), 3000)
                            }
                          }}
                          className="w-full px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          선택된 다른 채널들에 복사
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

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
                          {isSelfGroup ? 'self (그룹)' : group.type}
                        </span>
                        <span className="text-sm text-gray-500">({group.channels.length})</span>
                        {isSelfGroup && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            단일 세부정보 공유
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleGroupSelection(group.type)
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                        title={isSelfGroup ? 'self 채널 그룹 전체 선택/해제 (모든 self 채널이 동일한 세부정보를 공유합니다)' : '그룹 전체 선택/해제'}
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
                              ℹ️ self 채널들은 모두 동일한 세부정보를 공유합니다. 개별 채널을 선택해도 저장 시 하나의 그룹으로 저장됩니다.
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
                          
                          // 디버깅: 통계가 없는 채널 확인
                          if (!statsText && Object.keys(channelPricingStats).length > 0) {
                            console.log(`채널 "${channel.name}" (ID: ${channel.id})에 대한 통계가 없습니다.`, {
                              channelId: channel.id,
                              channelName: channel.name,
                              availableChannelIds: Object.keys(channelPricingStats).filter(k => k.includes(channel.id) || k.includes(channel.name)),
                              hasStatsById: !!channelPricingStats[channel.id],
                              hasStatsByName: !!channelPricingStats[channel.name]
                            });
                          }

                          return (
                            <label
                              key={channel.id}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedChannels[channel.id] || false}
                                onChange={() => toggleChannelSelection(channel.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <div className="flex flex-col flex-1">
                                <span className="text-sm text-gray-700">{channel.name}</span>
                                {statsText && (
                                  <span className="text-xs text-gray-500 mt-0.5">{statsText}</span>
                                )}
                              </div>
                              {isSelfGroup && selectedChannels[channel.id] && (
                                <span className="text-xs text-blue-600">(그룹)</span>
                              )}
                            </label>
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

          {/* 오른쪽: 입력 섹션 */}
          <div className="flex-1 p-4 overflow-y-auto">
            {Object.keys(selectedChannels).filter(id => selectedChannels[id]).length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">채널을 선택해주세요</p>
                  <p className="text-sm mt-1">왼쪽에서 편집할 채널을 선택하면 여기에 입력 폼이 표시됩니다.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    <strong>{Object.keys(selectedChannels).filter(id => selectedChannels[id]).length}개 채널</strong>에 동일한 내용을 저장합니다.
                    각 채널별로 다른 내용이 필요한 경우 개별적으로 편집하세요.
                  </p>
                </div>

                {/* 기존 입력 폼들 - 여기에 기존의 모든 입력 필드들이 들어갑니다 */}
                {/* 슬로건 섹션 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">슬로건</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        슬로건 1
                      </label>
                      <input
                        type="text"
                        value={getValue('slogan1', true)}
                        onChange={(e) => handleInputChange('slogan1', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="예: 최고의 투어 경험"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        슬로건 2
                      </label>
                      <input
                        type="text"
                        value={getValue('slogan2', true)}
                        onChange={(e) => handleInputChange('slogan2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="예: 전문 가이드와 함께"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        슬로건 3
                      </label>
                      <input
                        type="text"
                        value={getValue('slogan3', true)}
                        onChange={(e) => handleInputChange('slogan3', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="예: 잊지 못할 추억"
                      />
                    </div>
                  </div>
                </div>

                {/* 상품 설명 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">상품 설명</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      상세 설명
                    </label>
                    <LightRichEditor
                      value={getValue('description', true) as string}
                      onChange={(value) => handleInputChange('description', value || '')}
                      height={150}
                      placeholder="상품에 대한 자세한 설명을 입력해주세요"
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 포함/불포함 정보 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">포함/불포함 정보</h4>
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
                        불포함 사항
                      </label>
                      <LightRichEditor
                        value={getValue('not_included', true) as string}
                        onChange={(value) => handleInputChange('not_included', value || '')}
                        height={150}
                        placeholder="불포함되는 사항들을 입력해주세요"
                        enableResize={true}
                      />
                    </div>
                  </div>
                </div>

                {/* 픽업/드롭 정보 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">픽업/드롭 정보</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      픽업 및 드롭 정보
                    </label>
                    <LightRichEditor
                      value={getValue('pickup_drop_info', true) as string}
                      onChange={(value) => handleInputChange('pickup_drop_info', value || '')}
                      height={120}
                      placeholder="픽업 및 드롭에 대한 정보를 입력해주세요"
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 수하물 정보 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">수하물 정보</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      수하물 관련 정보
                    </label>
                    <LightRichEditor
                      value={getValue('luggage_info', true) as string}
                      onChange={(value) => handleInputChange('luggage_info', value || '')}
                      height={120}
                      placeholder="수하물에 대한 정보를 입력해주세요"
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 투어 운영 정보 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">투어 운영 정보</h4>
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
                  <h4 className="text-md font-medium text-gray-900">준비 사항</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      준비해야 할 사항들
                    </label>
                    <LightRichEditor
                      value={getValue('preparation_info', true) as string}
                      onChange={(value) => handleInputChange('preparation_info', value || '')}
                      height={120}
                      placeholder="준비해야 할 사항들을 입력해주세요"
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 소그룹 정보 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">소그룹 정보</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      소그룹 투어 관련 정보
                    </label>
                    <LightRichEditor
                      value={getValue('small_group_info', true) as string}
                      onChange={(value) => handleInputChange('small_group_info', value || '')}
                      height={120}
                      placeholder="소그룹 투어에 대한 정보를 입력해주세요"
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 안내사항 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">안내사항</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      중요한 안내사항들
                    </label>
                    <LightRichEditor
                      value={getValue('notice_info', true) as string}
                      onChange={(value) => handleInputChange('notice_info', value || '')}
                      height={120}
                      placeholder="중요한 안내사항들을 입력해주세요"
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 단독투어 정보 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">단독투어 정보</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      단독투어 관련 정보
                    </label>
                    <LightRichEditor
                      value={getValue('private_tour_info', true) as string}
                      onChange={(value) => {
                        console.log('단독투어 정보 onChange 호출됨:', {
                          value: value,
                          valueType: typeof value,
                          valueLength: value?.length,
                          isNull: value === null,
                          isUndefined: value === undefined,
                          isEmptyString: value === '',
                          trimmed: typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : null
                        })
                        // null이나 undefined를 빈 문자열로 변환
                        const processedValue = value == null ? '' : (typeof value === 'string' ? value : String(value))
                        console.log('processedValue:', processedValue, 'length:', processedValue.length)
                        handleInputChange('private_tour_info', processedValue)
                      }}
                      height={120}
                      placeholder="단독투어에 대한 정보를 입력해주세요"
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 취소 정책 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">취소 정책</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      취소 및 환불 정책
                    </label>
                    <LightRichEditor
                      value={getValue('cancellation_policy', true) as string}
                      onChange={(value) => handleInputChange('cancellation_policy', value || '')}
                      height={150}
                      placeholder="취소 및 환불 정책을 입력해주세요"
                      enableResize={true}
                    />
                  </div>
                </div>

                {/* 채팅 공지 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">채팅 공지</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      채팅방 공지사항
                    </label>
                    <LightRichEditor
                      value={getValue('chat_announcement', true) as string}
                      onChange={(value) => {
                        console.log('채팅 공지 onChange 호출됨:', {
                          value: value,
                          valueType: typeof value,
                          valueLength: value?.length,
                          isNull: value === null,
                          isUndefined: value === undefined,
                          isEmptyString: value === '',
                          trimmed: typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : null
                        })
                        // null이나 undefined를 빈 문자열로 변환
                        const processedValue = value == null ? '' : (typeof value === 'string' ? value : String(value))
                        console.log('processedValue:', processedValue, 'length:', processedValue.length)
                        handleInputChange('chat_announcement', processedValue)
                      }}
                      height={120}
                      placeholder="채팅방에 표시될 공지사항을 입력해주세요"
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
                    {saving ? '저장 중...' : '선택된 채널 저장'}
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
                saveMessage.includes('성공') || saveMessage.includes('번역') ? 'text-green-600' : 'text-red-600'
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
              {saving ? '저장 중...' : '저장'}
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
                saveMessage.includes('성공') || saveMessage.includes('번역') ? 'text-green-600' : 'text-red-600'
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
    </div>
  )
}
