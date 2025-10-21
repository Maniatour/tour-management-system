'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { 
  DollarSign, 
  Calendar,
  MessageCircle,
  Image,
  Tag,
  ArrowLeft,
  TrendingUp,
  Clock,
  Info,
  Settings,
  Trash2,
  MapPin,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
// import type { Database } from '@/lib/supabase'
import DynamicPricingManager from '@/components/DynamicPricingManager'
import ChangeHistory from '@/components/ChangeHistory'
import BasicInfoTab from '@/components/product/BasicInfoTab'
import OptionsTab from '@/components/product/OptionsTab'
import ChoicesTab from '@/components/product/ChoicesTabNew'
import ProductDetailsTab from '@/components/product/ProductDetailsTab'
import ProductScheduleTab from '@/components/product/ProductScheduleTab'
import ProductFaqTab from '@/components/product/ProductFaqTab'
import ProductMediaTab from '@/components/product/ProductMediaTab'
import TourCoursesTab from '@/components/product/TourCoursesTab'
import GlobalOptionModal from '@/components/product/GlobalOptionModal'
import OptionsManualModal from '@/components/product/OptionsManualModal'
import ProductPreviewSidebar from '@/components/product/ProductPreviewSidebar'

// 타입 정의는 필요에 따라 추가

// 기존 인터페이스들은 폼에서 사용하기 위해 유지

interface ProductOptionChoice {
  id: string // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  name: string
  description: string
  priceAdjustment: {
    adult: number
    child: number
    infant: number
  }
  isDefault?: boolean
}

interface ProductOption {
  id: string // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  name: string
  description: string
  isRequired: boolean
  isMultiple: boolean
  choices: ProductOptionChoice[]
  linkedOptionId?: string // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  adultPrice?: number
  childPrice?: number
  infantPrice?: number
  priceAdjustment?: {
    adult: number
    child: number
    infant: number
  }
}

interface ChannelPricing {
  channelId: string // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  channelName: string
  pricingType: 'percentage' | 'fixed' | 'multiplier'
  adjustment: number
  description: string
  isActive: boolean
}

interface SeasonalPricing {
  id: string // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  name: string
  startDate: string
  endDate: string
  pricingType: 'percentage' | 'fixed' | 'multiplier'
  adjustment: number
  description: string
  isActive: boolean
}

interface Coupon {
  id: string // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  code: string
  fixedDiscountAmount: number // 고정 할인 금액 ($)
  percentageDiscount: number // 퍼센트 할인 (%)
  discountPriority: 'fixed_first' | 'percentage_first' // 할인 적용 우선순위
  minAmount: number
  maxDiscount: number
  isActive: boolean
}

interface GlobalOption {
  id: string // text 타입 (데이터베이스에서 uuid -> text로 변경됨)
  name: string
  category: string
  description: string
  adultPrice: number
  childPrice: number
  infantPrice: number
  priceType: 'perPerson' | 'perTour' | 'perHour' | 'fixed'
  status: 'active' | 'inactive' | 'seasonal'
  tags: string[]
}

interface AdminProductEditProps {
  params: Promise<{ locale: string; id: string }>
}

export default function AdminProductEdit({ params }: AdminProductEditProps) {
  console.log('AdminProductEdit: Component initializing...')
  
  // 안전한 JSON 파싱 유틸리티 함수
  const safeJsonParse = <T = unknown>(str: string | null | undefined, fallback: T | null = null): T | null => {
    if (!str || typeof str !== 'string' || str.trim() === '') {
      return fallback;
    }
    try {
      return JSON.parse(str) as T;
    } catch (error) {
      console.error('JSON 파싱 에러:', error, '입력값:', str);
      return fallback;
    }
  };
  
  const paramsObj = useParams()
  const locale = paramsObj.locale as string
  const id = paramsObj.id as string
  const t = useTranslations('common')
  const router = useRouter()
  const isNewProduct = id === 'new'
  const supabase = createClientSupabase()
  const { user, loading: authLoading } = useAuth()
  
  console.log('AdminProductEdit: Auth state:', { user: !!user, authLoading })
  
  const [activeTab, setActiveTab] = useState('basic')
  const [showManualModal, setShowManualModal] = useState(false)
  const [showAddOptionModal, setShowAddOptionModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [productInfo, setProductInfo] = useState<{
    name: string
    productCode: string
    category: string
    subCategory: string
  } | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    nameEn?: string
    productCode: string
    category: string
    subCategory: string
    description: string
    duration: number
    basePrice: { adult: number; child: number; infant: number }
    channelPricing: ChannelPricing[]
    seasonalPricing: SeasonalPricing[]
    coupons: Coupon[]
    maxParticipants: number
    status: 'active' | 'inactive' | 'draft'
    productOptions: ProductOption[]
    // 새로운 필드들
    departureCity: string
    arrivalCity: string
    departureCountry: string
    arrivalCountry: string
    languages: string[]
    groupSize: string[]
    adultAge: number
    childAgeMin: number
    childAgeMax: number
    infantAge: number
    // 새로운 필드들
    tourDepartureTime?: string
    tourDepartureTimes?: string[]
    customerNameKo?: string
    customerNameEn?: string
    tags?: string[]
    // 공통 세부정보 사용 여부
    useCommonDetails: boolean
    // 팀 타입
    team_type: 'guide+driver' | '2guide' | null
    // product_details 필드들 (다국어 지원)
    productDetails: {
      [languageCode: string]: {
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
    }
    // 현재 선택된 언어
    currentLanguage: string
    // 각 언어별 공통 정보 사용 여부
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
  }>({
    name: '',
    nameEn: '',
    productCode: '',
    category: 'nature',
    subCategory: '',
    description: '',
    duration: 1,
    basePrice: {
      adult: 0,
      child: 0,
      infant: 0
    },
    channelPricing: [
      { channelId: '1', channelName: '직접 방문', pricingType: 'fixed' as const, adjustment: 0, description: '기본 가격', isActive: true },
      { channelId: '2', channelName: '네이버 여행', pricingType: 'percentage' as const, adjustment: -10, description: '10% 할인', isActive: true },
      { channelId: '3', channelName: '카카오 여행', pricingType: 'percentage' as const, adjustment: -8, description: '8% 할인', isActive: true },
      { channelId: '4', channelName: '마이리얼트립', pricingType: 'fixed' as const, adjustment: 5, description: '5달러 추가', isActive: true },
      { channelId: '5', channelName: '제휴 호텔', pricingType: 'percentage' as const, adjustment: -15, description: '15% 할인', isActive: true },
      { channelId: '6', channelName: '제휴 카페', pricingType: 'percentage' as const, adjustment: -12, description: '12% 할인', isActive: true }
    ],
    seasonalPricing: [
      { id: '1', name: '성수기 (7-8월)', startDate: '2024-07-01', endDate: '2024-08-31', pricingType: 'percentage' as const, adjustment: 20, description: '성수기 20% 추가', isActive: true },
      { id: '2', name: '비수기 (1-2월)', startDate: '2024-01-01', endDate: '2024-02-28', pricingType: 'percentage' as const, adjustment: -15, description: '비수기 15% 할인', isActive: true }
    ],
    coupons: [
          { id: '1', code: 'WELCOME10', fixedDiscountAmount: 0, percentageDiscount: 10, discountPriority: 'percentage_first' as const, minAmount: 100, maxDiscount: 50, isActive: true },
          { id: '2', code: 'SAVE20', fixedDiscountAmount: 20, percentageDiscount: 0, discountPriority: 'fixed_first' as const, minAmount: 200, maxDiscount: 20, isActive: true }
    ],
    maxParticipants: 10,
    status: 'active' as const,
    productOptions: [],
    // 새로운 필드들의 초기값
    departureCity: '',
    arrivalCity: '',
    departureCountry: '',
    arrivalCountry: '',
    languages: ['ko'],
    groupSize: ['private'],
    adultAge: 13,
    childAgeMin: 3,
    childAgeMax: 12,
    infantAge: 2,
    // 새로운 필드들 초기값
    tourDepartureTime: '',
    tourDepartureTimes: [],
    customerNameKo: '',
    customerNameEn: '',
    tags: [],
    // 공통 세부정보 사용 여부 초기값
    useCommonDetails: false,
    // 팀 타입 초기값
    team_type: null,
    // product_details 초기값 (다국어 지원)
    productDetails: {
      ko: {
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
    },
    // 현재 선택된 언어 초기값
    currentLanguage: 'ko',
    // 각 언어별 공통 정보 사용 여부 초기값
    useCommonForField: {
      ko: {
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
  })

  const [globalOptions, setGlobalOptions] = useState<GlobalOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  // 글로벌 옵션 불러오기
  const fetchGlobalOptions = useCallback(async () => {
    try {
      setLoadingOptions(true)
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .eq('status', 'active')
        .order('name')

      if (error) {
        console.error('Error fetching options:', error)
        return
      }

      if (data) {
        type OptionRow = {
          id: string
          name: string
          category: string
          description: string | null
          adult_price: number | null
          child_price: number | null
          infant_price: number | null
          price_type: 'perPerson' | 'perTour' | 'perHour' | 'fixed'
          status: 'active' | 'inactive' | 'seasonal'
          tags: string[] | null
        }
        const formattedOptions: GlobalOption[] = (data as unknown as OptionRow[]).map((option) => ({
          id: option.id,
          name: option.name,
          category: option.category,
          description: option.description || '',
          adultPrice: option.adult_price || 0,
          childPrice: option.child_price || 0,
          infantPrice: option.infant_price || 0,
          priceType: option.price_type,
          status: option.status,
          tags: option.tags || []
        }))
        setGlobalOptions(formattedOptions)
      }
    } catch (error) {
      console.error('Error fetching options:', error)
    } finally {
      setLoadingOptions(false)
    }
  }, [supabase])

  // 인증 체크 완전 제거
  console.log('Product page: Auth state:', { authLoading, user: !!user, userEmail: user?.email })

  // 새 상품 생성 시 기본값 설정
  useEffect(() => {
    if (isNewProduct) {
      setProductInfo({
        name: '',
        productCode: '',
        category: 'nature',
        subCategory: '',
      })
      
      setFormData(prevData => ({
        ...prevData,
        name: '',
        nameEn: '',
        productCode: '',
        category: 'nature',
        subCategory: '',
        description: '',
        duration: 3.5,
        basePrice: { adult: 0, child: 0, infant: 0 },
        channelPricing: [
          { channelId: '1', channelName: '직접 방문', pricingType: 'fixed', adjustment: 0, description: '기본 가격', isActive: true },
          { channelId: '2', channelName: '네이버 여행', pricingType: 'percentage', adjustment: -10, description: '10% 할인', isActive: true },
          { channelId: '3', channelName: '카카오 여행', pricingType: 'percentage', adjustment: -8, description: '8% 할인', isActive: true },
          { channelId: '4', channelName: '마이리얼트립', pricingType: 'fixed', adjustment: 5, description: '5달러 추가', isActive: true },
          { channelId: '5', channelName: '제휴 호텔', pricingType: 'percentage', adjustment: -15, description: '15% 할인', isActive: true },
          { channelId: '6', channelName: '제휴 카페', pricingType: 'percentage', adjustment: -12, description: '12% 할인', isActive: true }
        ],
        seasonalPricing: [
          { id: '1', name: '성수기 (7-8월)', startDate: '2024-07-01', endDate: '2024-08-31', pricingType: 'percentage' as const, adjustment: 20, description: '성수기 20% 추가', isActive: true },
          { id: '2', name: '비수기 (1-2월)', startDate: '2024-01-01', endDate: '2024-02-28', pricingType: 'percentage' as const, adjustment: -15, description: '비수기 15% 할인', isActive: true }
        ],
        coupons: [
          { id: '1', code: 'WELCOME10', fixedDiscountAmount: 0, percentageDiscount: 10, discountPriority: 'percentage_first' as const, minAmount: 100, maxDiscount: 50, isActive: true },
          { id: '2', code: 'SAVE20', fixedDiscountAmount: 20, percentageDiscount: 0, discountPriority: 'fixed_first' as const, minAmount: 200, maxDiscount: 20, isActive: true }
        ],
        maxParticipants: 10,
        status: 'active',
        productOptions: [],
        // 새로운 필드들
        departureCity: '',
        arrivalCity: '',
        departureCountry: '',
        arrivalCountry: '',
        languages: ['ko'],
        groupSize: ['private'],
        adultAge: 13,
        childAgeMin: 3,
        childAgeMax: 12,
        infantAge: 2,
        tourDepartureTime: '',
        tourDepartureTimes: [],
        customerNameKo: '',
        customerNameEn: '',
        tags: []
      }))
    }
  }, [isNewProduct])

  // 컴포넌트 마운트 시 글로벌 옵션 불러오기
  useEffect(() => {
    fetchGlobalOptions()
  }, [fetchGlobalOptions])

  // formData 변경 시 productInfo 업데이트
  useEffect(() => {
    if (formData.name || formData.productCode || formData.category || formData.subCategory) {
      setProductInfo({
        name: formData.name,
        productCode: formData.productCode,
        category: formData.category,
        subCategory: formData.subCategory,
      })
    }
  }, [formData.name, formData.productCode, formData.category, formData.subCategory])

  // 기존 상품 데이터 로드 (편집 시)
  useEffect(() => {
    const fetchProductData = async () => {
      if (!isNewProduct && id !== 'new') {
        try {
          // 1. 상품 기본 정보 로드
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: productData, error: productError } = await (supabase as any)
          .from('products')
          .select('*')
          .eq('id', id)
          .single()

          if (productError) throw productError

          // 디버깅: 데이터베이스에서 가져온 모든 필드 확인
          console.log('=== Product Data Debug ===')
          console.log('Full productData:', productData)
          console.log('Available fields:', Object.keys(productData))
          console.log('departure_country:', productData.departure_country)
          console.log('arrival_country:', productData.arrival_country)
          console.log('departure_city:', productData.departure_city)
          console.log('arrival_city:', productData.arrival_city)

          // 2. 상품 옵션 정보 로드
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: optionsData, error: optionsError } = await (supabase as any)
            .from('product_options')
            .select('*')
            .eq('product_id', id)
            .order('name', { ascending: true })

          if (optionsError) throw optionsError

          // optionsData 안전성 확인
          console.log('=== Options Data Debug ===')
          console.log('optionsData:', optionsData)
          console.log('optionsData type:', Array.isArray(optionsData) ? 'array' : typeof optionsData)
          if (Array.isArray(optionsData) && optionsData.length > 0) {
            console.log('optionsData length:', optionsData.length)
          }

          // 3. 상품 세부정보 로드 (공통 여부 반영)
          let detailsData: unknown = null
          let detailsError: { code?: string } | null = null
          if (productData?.use_common_details) {
            const { data: commonData, error: commonError } = await supabase
              .from('product_details_common_multilingual')
              .select('*')
              .eq('sub_category', productData.sub_category)
              .maybeSingle()
            detailsData = commonData
            detailsError = commonError
          } else {
            // 다국어 데이터를 모두 가져와서 언어별로 매핑
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: ownData, error: ownError } = await (supabase as any)
              .from('product_details_multilingual')
              .select('*')
              .eq('product_id', id)
            detailsData = ownData
            detailsError = ownError
          }

          if (detailsError && detailsError.code !== 'PGRST116') { // PGRST116은 데이터가 없을 때 발생
            throw detailsError
          }

          // 디버깅: 세부정보 데이터 확인
          console.log('=== Product Details Data Debug ===')
          console.log('detailsData:', detailsData)
          console.log('detailsData type:', Array.isArray(detailsData) ? 'array' : typeof detailsData)
          if (Array.isArray(detailsData) && detailsData.length > 0) {
            console.log('detailsData length:', detailsData.length)
            detailsData.forEach((item, index) => {
              console.log(`detailsData[${index}]:`, item)
            })
          } else if (detailsData && !Array.isArray(detailsData)) {
            console.log('detailsData (object):', detailsData)
          }



          // 4. 상품 정보 상태 설정
          setProductInfo({
            name: productData.name || '',
            productCode: productData.product_code || '',
            category: productData.category || 'nature',
            subCategory: productData.sub_category || '',
          })

          // 5. 폼 데이터 설정
          setFormData((prevData) => ({
            ...prevData,
            name: productData.name || '',
            nameEn: productData.name_en || '',
            productCode: productData.product_code || '',
            category: productData.category || 'nature',
            subCategory: productData.sub_category || '',
            description: productData.description || '',
            duration: typeof productData.duration === 'string' ? parseInt(productData.duration) || 1 : productData.duration || 1,
            basePrice: {
              adult: productData.base_price || 0,
              child: 0, // child_base_price 필드가 데이터베이스에 없음
              infant: 0, // infant_base_price 필드가 데이터베이스에 없음
            },
            maxParticipants: productData.max_participants || 10,
            status: (productData.status as 'active' | 'inactive' | 'draft') || 'active',
            departureCity: productData.departure_city || '',
            arrivalCity: productData.arrival_city || '',
            departureCountry: productData.departure_country || '',
            arrivalCountry: productData.arrival_country || '',
                         languages: productData.languages || ['ko'],
             groupSize: productData.group_size ? productData.group_size.split(',').filter(Boolean) : ['private'],
             adultAge: productData.adult_age || 13,
            childAgeMin: productData.child_age_min || 3,
            childAgeMax: productData.child_age_max || 12,
            infantAge: productData.infant_age || 2,
            tourDepartureTime: productData.tour_departure_time || '',
            tourDepartureTimes: (() => {
              console.log('tour_departure_times 원본 데이터:', productData.tour_departure_times);
              console.log('데이터 타입:', typeof productData.tour_departure_times);
              console.log('배열 여부:', Array.isArray(productData.tour_departure_times));
              
              // Supabase JSONB는 이미 파싱된 상태로 반환되므로 직접 사용
              if (Array.isArray(productData.tour_departure_times)) {
                console.log('배열로 인식됨, 직접 반환:', productData.tour_departure_times);
                return productData.tour_departure_times;
              }
              // 문자열인 경우에만 파싱 시도
              if (typeof productData.tour_departure_times === 'string') {
                console.log('문자열로 인식됨, 파싱 시도:', productData.tour_departure_times);
                const parsed = safeJsonParse(productData.tour_departure_times, []);
                console.log('파싱 결과:', parsed);
                return Array.isArray(parsed) ? parsed : [];
              }
              console.log('기본값 반환: []');
              return [];
            })(),
            customerNameKo: productData.customer_name_ko || '',
            customerNameEn: productData.customer_name_en || '',
            tags: productData.tags || [],
            useCommonDetails: !!productData.use_common_details,
            team_type: productData.team_type || null,
            // product_details 데이터 설정 (다국어 지원)
            productDetails: detailsData ? (() => {
              // 다국어 데이터를 언어별로 매핑
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const multilingualDetails: Record<string, any> = {}
              if (Array.isArray(detailsData) && detailsData.length > 0) {
                // 여러 언어 데이터가 있는 경우
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                detailsData.forEach((item: any) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  multilingualDetails[(item as any).language_code || 'ko'] = {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    slogan1: (item as any).slogan1 || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    slogan2: (item as any).slogan2 || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    slogan3: (item as any).slogan3 || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    description: (item as any).description || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    included: (item as any).included || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    not_included: (item as any).not_included || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    pickup_drop_info: (item as any).pickup_drop_info || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    luggage_info: (item as any).luggage_info || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tour_operation_info: (item as any).tour_operation_info || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    preparation_info: (item as any).preparation_info || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    small_group_info: (item as any).small_group_info || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    notice_info: (item as any).notice_info || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    private_tour_info: (item as any).private_tour_info || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    cancellation_policy: (item as any).cancellation_policy || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    chat_announcement: (item as any).chat_announcement || '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tags: (item as any).tags || []
                  }
                })
              } else if (detailsData) {
                // 단일 언어 데이터가 있는 경우
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                multilingualDetails[(detailsData as any).language_code || 'ko'] = {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  slogan1: (detailsData as any).slogan1 || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  slogan2: (detailsData as any).slogan2 || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  slogan3: (detailsData as any).slogan3 || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  description: (detailsData as any).description || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  included: (detailsData as any).included || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  not_included: (detailsData as any).not_included || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  pickup_drop_info: (detailsData as any).pickup_drop_info || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  luggage_info: (detailsData as any).luggage_info || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  tour_operation_info: (detailsData as any).tour_operation_info || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  preparation_info: (detailsData as any).preparation_info || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  small_group_info: (detailsData as any).small_group_info || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  notice_info: (detailsData as any).notice_info || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  private_tour_info: (detailsData as any).private_tour_info || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  cancellation_policy: (detailsData as any).cancellation_policy || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  chat_announcement: (detailsData as any).chat_announcement || '',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  tags: (detailsData as any).tags || []
                }
              }
              
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
              
              return multilingualDetails
            })() : {
              ko: {
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
            },
            // 각 필드별 공통 정보 사용 여부 초기값
            useCommonForField: (() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const useCommonForField: Record<string, any> = {}
              const availableLanguages = ['ko', 'en', 'ja', 'zh']
              
              // 모든 언어에 대해 초기값 설정
              availableLanguages.forEach(lang => {
                useCommonForField[lang] = {
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
              })
              
              return useCommonForField
            })(),
            productOptions: (() => {
              try {
                if (!optionsData || !Array.isArray(optionsData)) {
                  return []
                }

                // 간단한 그룹화 로직
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const groupedOptions: Record<string, any> = {}
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                optionsData.forEach((option: any) => {
                  const optionKey = option.name || 'unnamed'
                  
                  if (!groupedOptions[optionKey]) {
                    groupedOptions[optionKey] = {
                      id: option.id,
                      name: option.name,
                      description: option.description || '',
                      isRequired: option.is_required || false,
                      isMultiple: option.is_multiple || false,
                      linkedOptionId: option.linked_option_id || undefined,
                      adultPrice: option.adult_price_adjustment || 0,
                      childPrice: option.child_price_adjustment || 0,
                      infantPrice: option.infant_price_adjustment || 0,
                      choices: []
                    }
                  }
                  
                  // choice가 있는 경우에만 추가
                  if (option.choice_name) {
                    groupedOptions[optionKey].choices.push({
                      id: option.id,
                      name: option.choice_name,
                      description: option.choice_description || '',
                      priceAdjustment: {
                        adult: option.adult_price_adjustment || 0,
                        child: option.child_price_adjustment || 0,
                        infant: option.infant_price_adjustment || 0
                      },
                      isDefault: option.is_default || false
                    })
                  }
                })
                
                return Object.values(groupedOptions)
              } catch (error) {
                console.error('productOptions 초기화 오류:', error)
                return []
              }
            })()
          }))
        } catch (error) {
          console.error('상품 데이터 로드 중 오류 발생:', error)
        }
      }
    }

    fetchProductData()
  }, [id, isNewProduct, supabase])


  // 상품 삭제 함수
  const handleDeleteProduct = async () => {
    if (isNewProduct) return
    
    try {
      setDeleting(true)
      
      // 1. 상품 옵션 삭제
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: optionsError } = await (supabase as any)
        .from('product_options')
        .delete()
        .eq('product_id', id)
      
      if (optionsError) {
        console.error('상품 옵션 삭제 오류:', optionsError)
        throw new Error(`상품 옵션 삭제 실패: ${optionsError.message}`)
      }

      // 2. 상품 삭제
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: productError } = await (supabase as any)
        .from('products')
        .delete()
        .eq('id', id)

      if (productError) {
        console.error('상품 삭제 오류:', productError)
        throw new Error(`상품 삭제 실패: ${productError.message}`)
      }

      console.log('상품 삭제 완료!')
      alert('상품이 성공적으로 삭제되었습니다!')
      router.push(`/${locale}/admin/products`)
      
    } catch (error) {
      console.error('상품 삭제 중 오류 발생:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      alert(`상품 삭제 중 오류가 발생했습니다.\n\n오류 내용: ${errorMessage}`)
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  // 상품 비활성화 함수
  const handleDeactivateProduct = async () => {
    if (isNewProduct) return
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('products')
        .update({ status: 'inactive' })
        .eq('id', id)

      if (error) {
        console.error('상품 비활성화 오류:', error)
        alert('상품 비활성화에 실패했습니다.')
        return
      }

      alert('상품이 비활성화되었습니다.')
      // 페이지 새로고침하여 상태 반영
      window.location.reload()
      
    } catch (error) {
      console.error('상품 비활성화 중 오류 발생:', error)
      alert('상품 비활성화 중 오류가 발생했습니다.')
    }
  }

  const addProductOptionFromGlobal = (globalOption: GlobalOption) => {
    try {
      // 글로벌 옵션 데이터 검증
      if (!globalOption || !globalOption.id || !globalOption.name) {
        console.error('Invalid global option data:', globalOption)
        alert('유효하지 않은 글로벌 옵션 데이터입니다.')
        return
      }

      const newOption: ProductOption = {
        id: `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: globalOption.name || '새 옵션',
        description: globalOption.description || '',
        isRequired: false,
        isMultiple: false,
        adultPrice: Number(globalOption.adultPrice) || 0,
        childPrice: Number(globalOption.childPrice) || 0,
        infantPrice: Number(globalOption.infantPrice) || 0,
        choices: [{
          id: `choice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: globalOption.name || '새 선택 항목',
          description: globalOption.description || '',
          priceAdjustment: {
            adult: Number(globalOption.adultPrice) || 0,
            child: Number(globalOption.childPrice) || 0,
            infant: Number(globalOption.infantPrice) || 0
          },
          isDefault: true
        }],
        linkedOptionId: globalOption.id
      }

      // 폼 데이터 업데이트 (상품 저장 없이)
      setFormData(prevData => {
        const updatedData = {
          ...prevData,
          productOptions: [...prevData.productOptions, newOption]
        }
        console.log('글로벌 옵션 추가됨 - 폼 데이터만 업데이트:', updatedData)
        return updatedData
      })

      // 모달 닫기
      setShowAddOptionModal(false)

      // 성공 메시지 (상품 저장 없음)
      console.log('글로벌 옵션이 성공적으로 추가되었습니다 (상품 저장 없음):', newOption)
    } catch (error) {
      console.error('글로벌 옵션 추가 중 오류 발생:', error)
      alert('글로벌 옵션 추가 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  const removeProductOption = (optionId: string) => {
    setFormData(prevData => ({ 
      ...prevData, 
      productOptions: prevData.productOptions.filter(opt => opt.id !== optionId) 
    }))
  }

  const updateProductOption = (optionId: string, updates: Partial<ProductOption>) => {
    setFormData(prevData => ({
      ...prevData,
      productOptions: prevData.productOptions.map(opt =>
        opt.id === optionId ? { ...opt, ...updates } : opt
      )
    }))
  }

  // addProductOption, addOptionChoice 등은 현재 UI에서 사용하지 않아 제거

  // 통합 가격 관련 함수들 (현재 사용되지 않음)
  /*
  const addChannel = () => {
    const newChannel: ChannelPricing = {
      channelId: `channel_${Date.now()}`,
      channelName: '새 채널',
      pricingType: 'percentage',
      adjustment: 0,
      description: '새로운 채널',
      isActive: true
    }
    setFormData(prevData => ({
      ...prevData,
      channelPricing: [...prevData.channelPricing, newChannel]
    }))
  }

  const addSeason = () => {
    const newSeason: SeasonalPricing = {
      id: `season_${Date.now()}`,
      name: '새 시즌',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      pricingType: 'percentage',
      adjustment: 0,
      description: '새로운 시즌',
      isActive: true
    }
    setFormData(prevData => ({
      ...prevData,
      seasonalPricing: [...prevData.seasonalPricing, newSeason]
    }))
  }
  */

  // const addCoupon = () => {
  //   const newCoupon: Coupon = {
  //     id: `coupon_${Date.now()}`,
  //     code: 'NEW' + Math.random().toString(36).substr(2, 5).toUpperCase(),
  //     fixedDiscountAmount: 0,
  //     percentageDiscount: 10,
  //     discountPriority: 'percentage_first',
  //     minAmount: 100,
  //     maxDiscount: 50,
  //     isActive: true
  //   }
  //   setFormData(prevData => ({
  //     ...prevData,
  //     coupons: [...prevData.coupons, newCoupon]
  //   }))
  // }

  const tabs = [
    { id: 'basic', label: t('basicInfo'), icon: Info },
    { id: 'dynamic-pricing', label: t('dynamicPricing'), icon: TrendingUp },
    { id: 'choices', label: '초이스 관리', icon: Settings },
    { id: 'options', label: t('optionsManagement'), icon: Settings },
    { id: 'details', label: t('details'), icon: Tag },
    { id: 'schedule', label: t('schedule'), icon: Calendar },
    { id: 'tour-courses', label: '투어 코스', icon: MapPin },
    { id: 'faq', label: t('faq'), icon: MessageCircle },
    { id: 'media', label: t('media'), icon: Image },
    { id: 'history', label: t('changeHistory'), icon: Clock }
  ]

  // 임시로 인증 체크를 비활성화하여 페이지가 로드되는지 확인
  console.log('Page render:', { authLoading, user: !!user, userEmail: user?.email })

  return (
    <div className="space-y-6">
      {/* 인증 체크 완전 제거 - 항상 페이지 표시 */}
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
                     <Link
             href={`/${locale}/admin/products`}
             className="text-gray-500 hover:text-gray-700"
           >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isNewProduct ? '새 상품 추가' : '상품 편집'}
              {productInfo && !isNewProduct && (
                <span className="ml-3 text-xl font-normal text-gray-600">
                  - {productInfo.name}
                  {productInfo.productCode && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({productInfo.productCode})
                    </span>
                  )}
                </span>
              )}
            </h1>
            <p className="mt-2 text-gray-600">
              {isNewProduct ? '새로운 투어 상품을 등록합니다' : '상품 정보를 수정합니다'}
              {productInfo && !isNewProduct && (
                <span className="ml-2 text-sm text-gray-500">
                  • {productInfo.category} • {productInfo.subCategory}
                </span>
              )}
            </p>
          </div>
        </div>
        
        {/* 액션 버튼들 */}
        {!isNewProduct && (
          <div className="flex items-center space-x-3">
            {/* 미리보기 버튼 */}
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>미리보기</span>
            </button>
            
            {/* 삭제 버튼 */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 transition-colors"
            >
              <Trash2 size={20} />
              <span>상품 삭제</span>
            </button>
          </div>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            // 새 상품일 때는 기본정보 탭만 표시
            if (isNewProduct && tab.id !== 'basic') {
              return null
            }
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="space-y-6">
        {/* 기본정보 탭 */}
        {activeTab === 'basic' && (
          <BasicInfoTab
            formData={formData}
            setFormData={setFormData as <T>(updater: React.SetStateAction<T>) => void}
            productId={id}
            isNewProduct={isNewProduct}
          />
        )}

        {/* 새 상품이 아닐 때만 다른 탭들 표시 */}
        {!isNewProduct && (
          <>
            {/* 가격관리 탭 - 동적 가격으로 통합됨 */}
            {activeTab === 'pricing' && (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">가격 관리</h3>
                <p className="text-gray-600">가격 관리는 &apos;동적 가격&apos; 탭에서 통합하여 관리합니다.</p>
              </div>
            )}

            {/* 동적 가격 탭 */}
            {activeTab === 'dynamic-pricing' && (
              <div className="space-y-6">
                <DynamicPricingManager 
                  productId={id} 
                  isNewProduct={isNewProduct}
                  onSave={(rule) => {
                    console.log('통합 가격 정보 저장됨:', rule);
                    // 동적 가격 정보가 성공적으로 저장되었음을 알림
                    // 상품 자체의 저장은 하단의 "변경사항 저장" 버튼을 통해 처리
                  }}
                />
              </div>
            )}

            {/* 초이스 관리 탭 */}
            {activeTab === 'choices' && (
              <ChoicesTab
                productId={id}
                isNewProduct={isNewProduct}
              />
            )}

            {/* 옵션관리 탭 */}
            {activeTab === 'options' && (
              <OptionsTab
                formData={formData}
                setShowAddOptionModal={setShowAddOptionModal}
                removeProductOption={removeProductOption}
                updateProductOption={updateProductOption}
                productId={id}
                isNewProduct={isNewProduct}
              />
            )}

            {/* 세부정보 탭 */}
            {activeTab === 'details' && (
              <ProductDetailsTab
                productId={id}
                isNewProduct={isNewProduct}
                subCategory={formData.subCategory}
                formData={{
                  useCommonDetails: formData.useCommonDetails,
                  productDetails: formData.productDetails,
                  currentLanguage: formData.currentLanguage,
                  useCommonForField: formData.useCommonForField
                }}
                setFormData={(updater: unknown) => {
                  setFormData((prev) => {
                    const current = {
                      useCommonDetails: prev.useCommonDetails,
                      productDetails: prev.productDetails,
                      currentLanguage: prev.currentLanguage,
                      useCommonForField: prev.useCommonForField
                    }
                    const next = typeof updater === 'function'
                      ? updater(current)
                      : updater
                    return {
                      ...prev,
                      useCommonDetails: next.useCommonDetails,
                      productDetails: next.productDetails,
                      currentLanguage: next.currentLanguage,
                      useCommonForField: next.useCommonForField
                    }
                  })
                }}
              />
            )}

            {/* 일정 탭 */}
            {activeTab === 'schedule' && (
              <ProductScheduleTab
                productId={id}
                isNewProduct={isNewProduct}
                formData={formData}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setFormData={(data: unknown) => setFormData(data as any)}
                teamType={formData?.team_type}
              />
            )}

            {/* 투어 코스 탭 */}
            {activeTab === 'tour-courses' && (
              <TourCoursesTab
                productId={id}
                isNewProduct={isNewProduct}
              />
            )}

            {/* FAQ 탭 */}
            {activeTab === 'faq' && (
              <ProductFaqTab
                productId={id}
                isNewProduct={isNewProduct}
                formData={formData}
                setFormData={setFormData as React.Dispatch<React.SetStateAction<Record<string, unknown>>>}
              />
            )}

            {/* 미디어 탭 */}
            {activeTab === 'media' && (
              <ProductMediaTab
                productId={id}
                isNewProduct={isNewProduct}
                formData={formData}
                setFormData={setFormData as React.Dispatch<React.SetStateAction<Record<string, unknown>>>}
              />
            )}

            {/* 변경 내역 탭 */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">상품 변경 내역</h3>
                  <p className="text-gray-600 mb-6">
                    이 상품의 모든 변경 사항을 추적하고 확인할 수 있습니다.
                  </p>
                </div>
                
                <ChangeHistory 
                  tableName="products" 
                  recordId={id} 
                  title="상품 변경 내역"
                  maxItems={10}
                />
              </div>
            )}
          </>
        )}

        {/* 저장 버튼 */}
      </div>

            {/* 옵션 관리 메뉴얼 모달 */}
      <OptionsManualModal
        show={showManualModal}
        onClose={() => setShowManualModal(false)}
      />

      {/* 글로벌 옵션 선택 모달 */}
      <GlobalOptionModal
        show={showAddOptionModal}
        onClose={() => setShowAddOptionModal(false)}
        globalOptions={globalOptions}
        loadingOptions={loadingOptions}
        locale={locale}
        onSelectOption={addProductOptionFromGlobal}
      />

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">상품 삭제 확인</h3>
            </div>
            
            <div className="text-gray-600 mb-6">
              <p className="mb-3 font-medium text-red-700">
                ⚠️ 상품 삭제 시 주의사항
              </p>
              <p className="mb-2">
                해당 상품을 삭제하면, 해당 상품의 기존 예약, 기존 투어 등의 데이터를 사용하지 못할 수 있습니다.
              </p>
              <p className="text-sm text-gray-500">
                더 이상 필요없는 상품이거나, 기존 예약건이 있다면 삭제하지 말고 <strong>비활성화</strong>를 해주세요.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex space-x-3">
                <button
                  onClick={handleDeactivateProduct}
                  className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  비활성화하기
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                  disabled={deleting}
                >
                  취소
                </button>
              </div>
              <button
                onClick={handleDeleteProduct}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? '삭제 중...' : '그래도 삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 사이드바 */}
      <ProductPreviewSidebar
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        productData={{
          name: formData.name,
          nameEn: formData.nameEn || undefined,
          customerNameKo: formData.customerNameKo || undefined,
          customerNameEn: formData.customerNameEn || undefined,
          description: formData.description,
          duration: formData.duration,
          maxParticipants: formData.maxParticipants,
          departureCity: formData.departureCity,
          arrivalCity: formData.arrivalCity,
          departureCountry: formData.departureCountry,
          arrivalCountry: formData.arrivalCountry,
          languages: formData.languages,
          groupSize: formData.groupSize,
          adultAge: formData.adultAge,
          childAgeMin: formData.childAgeMin,
          childAgeMax: formData.childAgeMax,
          infantAge: formData.infantAge,
          status: formData.status,
          tourDepartureTimes: formData.tourDepartureTimes || undefined,
          tags: formData.tags || undefined
        }}
        productDetails={formData.productDetails}
        currentLanguage={formData.currentLanguage}
      />
    </div>
  )
}
