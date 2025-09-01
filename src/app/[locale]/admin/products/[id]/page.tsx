'use client'

import React, { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Plus, 
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
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import DynamicPricingManager from '@/components/DynamicPricingManager'
import ChangeHistory from '@/components/ChangeHistory'
import BasicInfoTab from '@/components/product/BasicInfoTab'
import OptionsTab from '@/components/product/OptionsTab'
import GlobalOptionModal from '@/components/product/GlobalOptionModal'
import OptionsManualModal from '@/components/product/OptionsManualModal'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

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
  const { locale, id } = use(params)
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const isNewProduct = id === 'new'
  
  const [activeTab, setActiveTab] = useState('basic')
  const [showManualModal, setShowManualModal] = useState(false)
  const [showAddOptionModal, setShowAddOptionModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
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
    tags: string[]
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
  }>({
    name: '',
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
    tags: [],
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
    infantAge: 2
  })

  const [newTag, setNewTag] = useState('')
  const [globalOptions, setGlobalOptions] = useState<GlobalOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  // 글로벌 옵션 불러오기
  const fetchGlobalOptions = async () => {
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
        const formattedOptions: GlobalOption[] = data.map(option => ({
          id: option.id,
          name: option.name,
          category: option.category,
          description: option.description,
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
  }

  // 새 상품 생성 시 기본값 설정
  useEffect(() => {
    if (isNewProduct) {
      setFormData(prevData => ({
        ...prevData,
        name: '',
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
        tags: [],
        productOptions: [],
        // 새로운 필드들
        departureCity: '',
        arrivalCity: '',
        departureCountry: '',
        arrivalCountry: '',
        languages: ['ko'],
        groupSize: 'private',
        adultAge: 13,
        childAgeMin: 3,
        childAgeMax: 12,
        infantAge: 2
      }))
    }
  }, [isNewProduct])

  // 컴포넌트 마운트 시 글로벌 옵션 불러오기
  useEffect(() => {
    fetchGlobalOptions()
  }, [])

  // 기존 상품 데이터 로드 (편집 시)
  useEffect(() => {
    const fetchProductData = async () => {
      if (!isNewProduct && id !== 'new') {
        try {
          // 1. 상품 기본 정보 로드
          const { data: productData, error: productError } = await supabase
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
          const { data: optionsData, error: optionsError } = await supabase
            .from('product_options')
            .select(`
              *,
              product_option_choices (*)
            `)
            .eq('product_id', id)

          if (optionsError) throw optionsError



          // 3. 폼 데이터 설정
          setFormData(prevData => ({
            ...prevData,
            name: productData.name || '',
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
            tags: productData.tags || [],
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
                         productOptions: optionsData?.map((option: {
               id: string
               name: string
               description: string
               is_required: boolean
               is_multiple: boolean
               linked_option_id: string | null
               product_option_choices: Array<{
                 id: string
                 name: string
                 description: string
                 adult_price_adjustment: number
                 child_price_adjustment: number
                 infant_price_adjustment: number
                 is_default: boolean
               }>
             }) => ({
               id: option.id,
               name: option.name,
               description: option.description,
               isRequired: option.is_required,
               isMultiple: option.is_multiple,
               linkedOptionId: option.linked_option_id || undefined,
               choices: option.product_option_choices?.map((choice) => ({
                 id: choice.id,
                 name: choice.name,
                 description: choice.description,
                 priceAdjustment: {
                   adult: choice.adult_price_adjustment || 0,
                   child: choice.child_price_adjustment || 0,
                   infant: choice.infant_price_adjustment || 0
                 },
                 isDefault: choice.is_default || false
               })) || []
             })) || []
          }))
        } catch (error) {
          console.error('상품 데이터 로드 중 오류 발생:', error)
        }
      }
    }

    fetchProductData()
  }, [id, isNewProduct])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // 폼 데이터 검증
      if (!formData.name || !formData.name.trim()) {
        alert('상품명을 입력해주세요.')
        return
      }

      if (!formData.category) {
        alert('카테고리를 선택해주세요.')
        return
      }

      // 옵션 데이터 검증
      for (const option of formData.productOptions) {
        if (!option.name || !option.name.trim()) {
          alert('모든 옵션의 이름을 입력해주세요.')
          return
        }
        
        for (const choice of option.choices) {
          if (!choice.name || !choice.name.trim()) {
            alert('모든 선택 항목의 이름을 입력해주세요.')
            return
          }
        }
      }

      console.log('폼 제출 시작 - 데이터:', formData)
      
      // 1. 상품 기본 정보 저장
      let productId = id
      if (isNewProduct) {
        // 새 상품 생성
        const { data: productData, error: productError } = await supabase
          .from('products')
          .insert({
            name: formData.name.trim(),
            product_code: formData.productCode.trim(),
            category: formData.category,
            sub_category: formData.subCategory.trim(),
            description: formData.description.trim(),
            duration: formData.duration.toString(),
            base_price: formData.basePrice.adult,
            max_participants: formData.maxParticipants,
            status: formData.status,
            tags: formData.tags,
            departure_city: formData.departureCity.trim(),
            arrival_city: formData.arrivalCity.trim(),
            departure_country: formData.departureCountry,
            arrival_country: formData.arrivalCountry,
            languages: formData.languages,
            group_size: formData.groupSize.toString(),
            adult_age: formData.adultAge,
            child_age_min: formData.childAgeMin,
            child_age_max: formData.childAgeMax,
            infant_age: formData.infantAge
          })
          .select()
          .single()

        if (productError) {
          console.error('상품 생성 오류:', productError)
          throw new Error(`상품 생성 실패: ${productError.message}`)
        }
        
        productId = productData.id
        console.log('새 상품 생성됨:', productId)
      } else {
        // 기존 상품 업데이트
        const { data: updatedProduct, error: productError } = await supabase
          .from('products')
          .update({
            name: formData.name.trim(),
            product_code: formData.productCode.trim(),
            category: formData.category,
            sub_category: formData.subCategory.trim(),
            description: formData.description.trim(),
            duration: formData.duration.toString(),
            base_price: formData.basePrice.adult,
            max_participants: formData.maxParticipants,
            status: formData.status,
            tags: formData.tags,
            departure_city: formData.departureCity.trim(),
            arrival_city: formData.arrivalCity.trim(),
            departure_country: formData.departureCountry,
            arrival_country: formData.arrivalCountry,
            languages: formData.languages,
            group_size: formData.groupSize.toString(),
            adult_age: formData.adultAge,
            child_age_min: formData.childAgeMin,
            child_age_max: formData.childAgeMax,
            infant_age: formData.infantAge
          })
          .eq('id', productId)
          .select()
          .single()

        if (productError) {
          console.error('상품 업데이트 오류:', productError)
          throw new Error(`상품 업데이트 실패: ${productError.message}`)
        }
        
        console.log('기존 상품 업데이트됨:', productId)
      }

      // 2. 기존 product_options 삭제 (업데이트 시)
      if (!isNewProduct && formData.productOptions.length > 0) {
        console.log('기존 옵션 삭제 시작')
        const { error: deleteError } = await supabase
          .from('product_options')
          .delete()
          .eq('product_id', productId)
        
        if (deleteError) {
          console.error('기존 옵션 삭제 오류:', deleteError)
          throw new Error(`기존 옵션 삭제 실패: ${deleteError.message}`)
        }
        console.log('기존 옵션 삭제 완료')
      }

      // 3. 새로운 product_options 저장
      if (formData.productOptions.length > 0) {
        console.log('새 옵션 저장 시작:', formData.productOptions.length, '개')
        
        for (const option of formData.productOptions) {
          // product_options 테이블에 저장
          const { data: optionData, error: optionError } = await supabase
            .from('product_options')
            .insert({
              product_id: productId,
              name: option.name.trim(),
              description: option.description.trim(),
              is_required: option.isRequired,
              is_multiple: option.isMultiple,
              linked_option_id: option.linkedOptionId || null
            })
            .select()
            .single()

          if (optionError) {
            console.error('옵션 저장 오류:', optionError)
            throw new Error(`옵션 저장 실패: ${optionError.message}`)
          }

          console.log('옵션 저장됨:', optionData.id)

          // product_option_choices 테이블에 저장
          if (option.choices && option.choices.length > 0) {
            const choicesToInsert = option.choices.map((choice, index) => ({
              product_option_id: optionData.id,
              name: choice.name.trim(),
              description: choice.description.trim(),
              adult_price_adjustment: choice.priceAdjustment.adult,
              child_price_adjustment: choice.priceAdjustment.child,
              infant_price_adjustment: choice.priceAdjustment.infant,
              is_default: choice.isDefault || false,
              sort_order: index
            }))

            const { error: choicesError } = await supabase
              .from('product_option_choices')
              .insert(choicesToInsert)

            if (choicesError) {
              console.error('선택 항목 저장 오류:', choicesError)
              throw new Error(`선택 항목 저장 실패: ${choicesError.message}`)
            }
            
            console.log('선택 항목 저장됨:', choicesToInsert.length, '개')
          }
        }
      }

      console.log('상품 저장 완료!')
      alert('상품이 성공적으로 저장되었습니다!')
    router.push(`/${locale}/admin/products`)
      
    } catch (error) {
      console.error('상품 저장 중 오류 발생:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      alert(`상품 저장 중 오류가 발생했습니다.\n\n오류 내용: ${errorMessage}\n\n다시 시도해주세요.`)
    }
  }

  // 상품 삭제 함수
  const handleDeleteProduct = async () => {
    if (isNewProduct) return
    
    try {
      setDeleting(true)
      
      // 1. 상품 옵션 삭제
      const { error: optionsError } = await supabase
        .from('product_options')
        .delete()
        .eq('product_id', id)
      
      if (optionsError) {
        console.error('상품 옵션 삭제 오류:', optionsError)
        throw new Error(`상품 옵션 삭제 실패: ${optionsError.message}`)
      }

      // 2. 상품 삭제
      const { error: productError } = await supabase
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

  const addTag = () => {
    setFormData(prevData => {
      if (newTag.trim() && !prevData.tags.includes(newTag.trim())) {
      setNewTag('')
        return { ...prevData, tags: [...prevData.tags, newTag.trim()] }
    }
      return prevData
    })
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prevData => ({ ...prevData, tags: prevData.tags.filter(tag => tag !== tagToRemove) }))
  }

  const addProductOption = () => {
    const newOption: ProductOption = {
      id: `opt-${Date.now()}`,
      name: '',
      description: '',
      isRequired: false,
      isMultiple: false,
      choices: [],
      linkedOptionId: undefined
    }
    setFormData(prevData => ({ ...prevData, productOptions: [...prevData.productOptions, newOption] }))
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

  const addOptionChoice = (optionId: string) => {
    const newChoice: ProductOptionChoice = {
      id: `choice-${Date.now()}`,
      name: '',
      description: '',
      priceAdjustment: { adult: 0, child: 0, infant: 0 }
    }
    setFormData(prevData => ({
      ...prevData,
      productOptions: prevData.productOptions.map(opt =>
        opt.id === optionId 
          ? { ...opt, choices: [...opt.choices, newChoice] }
          : opt
      )
    }))
  }

  const removeOptionChoice = (optionId: string, choiceId: string) => {
    setFormData(prevData => ({
      ...prevData,
      productOptions: prevData.productOptions.map(opt =>
        opt.id === optionId 
          ? { ...opt, choices: opt.choices.filter(choice => choice.id !== choiceId) }
          : opt
      )
    }))
  }

  const updateOptionChoice = (optionId: string, choiceId: string, updates: Partial<ProductOptionChoice>) => {
    setFormData(prevData => ({
      ...prevData,
      productOptions: prevData.productOptions.map(opt =>
        opt.id === optionId 
          ? { 
              ...opt, 
              choices: opt.choices.map(choice =>
        choice.id === choiceId ? { ...choice, ...updates } : choice
      )
            }
          : opt
      )
    }))
  }

  const linkToGlobalOption = (optionId: string, globalOptionId: string) => {
    const globalOption = globalOptions.find(go => go.id === globalOptionId)
    if (globalOption) {
      // 글로벌 옵션과 연결하고 기본 선택 항목 생성
      const defaultChoice: ProductOptionChoice = {
        id: `choice-${Date.now()}`,
        name: globalOption.name,
        description: globalOption.description,
        priceAdjustment: {
          adult: globalOption.adultPrice,
          child: globalOption.childPrice,
          infant: globalOption.infantPrice
        },
        isDefault: true
      }

      updateProductOption(optionId, {
        name: globalOption.name,
        description: globalOption.description,
        linkedOptionId: globalOptionId,
        choices: [defaultChoice]
      })
    }
  }

  // 통합 가격 관련 함수들
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

  const addCoupon = () => {
    const newCoupon: Coupon = {
      id: `coupon_${Date.now()}`,
      code: 'NEW' + Math.random().toString(36).substr(2, 5).toUpperCase(),
      fixedDiscountAmount: 0,
      percentageDiscount: 10,
      discountPriority: 'percentage_first',
      minAmount: 100,
      maxDiscount: 50,
      isActive: true
    }
    setFormData(prevData => ({
      ...prevData,
      coupons: [...prevData.coupons, newCoupon]
    }))
  }

  const tabs = [
    { id: 'basic', label: '기본정보', icon: Info },
    { id: 'dynamic-pricing', label: '동적 가격', icon: TrendingUp },
    { id: 'options', label: '옵션관리', icon: Settings },
    { id: 'details', label: '세부정보', icon: Tag },
    { id: 'schedule', label: '일정', icon: Calendar },
    { id: 'faq', label: 'FAQ', icon: MessageCircle },
    { id: 'media', label: '미디어', icon: Image },
    { id: 'history', label: '변경 내역', icon: Clock }
  ]

  return (
    <div className="space-y-6">
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
            </h1>
            <p className="mt-2 text-gray-600">
              {isNewProduct ? '새로운 투어 상품을 등록합니다' : '상품 정보를 수정합니다'}
            </p>
          </div>
        </div>
        
        {/* 삭제 버튼 (기존 상품인 경우에만 표시) */}
        {!isNewProduct && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 transition-colors"
          >
            <Trash2 size={20} />
            <span>상품 삭제</span>
          </button>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
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

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본정보 탭 */}
        {activeTab === 'basic' && (
          <BasicInfoTab
            formData={formData}
            setFormData={setFormData}
            newTag={newTag}
            setNewTag={setNewTag}
            addTag={addTag}
            removeTag={removeTag}
              productId={id}
              isNewProduct={isNewProduct}
          />
        )}

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

        {/* 옵션관리 탭 */}
        {activeTab === 'options' && (
          <OptionsTab
            formData={formData}
            setFormData={setFormData}
            globalOptions={globalOptions}
            loadingOptions={loadingOptions}
            showManualModal={showManualModal}
            setShowManualModal={setShowManualModal}
            setShowAddOptionModal={setShowAddOptionModal}
            fetchGlobalOptions={fetchGlobalOptions}
            addProductOption={addProductOption}
            removeProductOption={removeProductOption}
            updateProductOption={updateProductOption}
            addOptionChoice={addOptionChoice}
            removeOptionChoice={removeOptionChoice}
            updateOptionChoice={updateOptionChoice}
            linkToGlobalOption={linkToGlobalOption}
              productId={id}
              isNewProduct={isNewProduct}
          />
        )}

        {/* 나머지 탭들 - 추후 구현 */}
        {activeTab === 'details' && (
          <div className="text-center py-8 text-gray-500">
            <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>세부정보 탭 - 추후 구현 예정</p>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>일정 탭 - 추후 구현 예정</p>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>FAQ 탭 - 추후 구현 예정</p>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="text-center py-8 text-gray-500">
            <Image className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>미디어 탭 - 추후 구현 예정</p>
          </div>
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

        {/* 저장 버튼 */}
        <div className="flex space-x-3 pt-6 border-t border-gray-200">
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700"
          >
            {isNewProduct ? '상품 추가' : '변경사항 저장'}
          </button>
                     <Link
             href={`/${locale}/admin/products`}
             className="bg-gray-300 text-gray-700 py-2 px-6 rounded-lg hover:bg-gray-400"
           >
            취소
          </Link>
        </div>
      </form>

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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">상품 삭제 확인</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              이 상품을 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 
              상품과 관련된 모든 옵션 정보도 함께 삭제됩니다.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                disabled={deleting}
              >
                취소
              </button>
              <button
                onClick={handleDeleteProduct}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
