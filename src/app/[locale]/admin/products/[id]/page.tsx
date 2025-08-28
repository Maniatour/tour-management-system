'use client'

import React, { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Package, 
  Users, 
  DollarSign, 
  Settings, 
  Star, 
  CheckCircle, 
  Link as LinkIcon,
  Info,
  Calendar,
  MessageCircle,
  Image,
  Tag,
  ArrowLeft,
  TrendingUp,
  Clock,
  Percent
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

// 기존 인터페이스들은 폼에서 사용하기 위해 유지
interface ProductOptionChoice {
  id: string
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
  id: string
  name: string
  description: string
  isRequired: boolean
  isMultiple: boolean
  choices: ProductOptionChoice[]
  linkedOptionId?: string
  priceAdjustment?: {
    adult: number
    child: number
    infant: number
  }
}

interface ChannelPricing {
  channelId: string
  channelName: string
  pricingType: 'percentage' | 'fixed' | 'multiplier'
  adjustment: number
  description: string
  isActive: boolean
}

interface SeasonalPricing {
  id: string
  name: string
  startDate: string
  endDate: string
  pricingType: 'percentage' | 'fixed' | 'multiplier'
  adjustment: number
  description: string
  isActive: boolean
}

interface Coupon {
  id: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minAmount: number
  maxDiscount: number
  validFrom: string
  validTo: string
  usageLimit: number
  currentUsage: number
  isActive: boolean
}

interface GlobalOption {
  id: string
  name: string
  category: string
  description: string
  basePrice: {
    adult: number
    child: number
    infant: number
  }
  priceType: 'perPerson' | 'perTour' | 'perHour' | 'fixed'
  minQuantity: number
  maxQuantity: number
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
  const [formData, setFormData] = useState<{
    name: string
    category: string
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
  }>({
    name: '',
    category: 'nature',
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
      { id: '1', code: 'WELCOME10', discountType: 'percentage' as const, discountValue: 10, minAmount: 100, maxDiscount: 50, validFrom: '2024-01-01', validTo: '2024-12-31', usageLimit: 1000, currentUsage: 0, isActive: true },
      { id: '2', code: 'SAVE20', discountType: 'fixed' as const, discountValue: 20, minAmount: 200, maxDiscount: 20, validFrom: '2024-01-01', validTo: '2024-12-31', usageLimit: 500, currentUsage: 0, isActive: true }
    ],
    maxParticipants: 10,
    status: 'active' as const,
    tags: [],
    productOptions: []
  })

  const [newTag, setNewTag] = useState('')
  const [globalOptions] = useState<GlobalOption[]>([
    {
      id: '1',
      name: '앤텔롭 캐년',
      category: 'attraction',
      description: '앤텔롭 캐년 방문 옵션',
      basePrice: { adult: 0, child: 0, infant: 0 },
      priceType: 'perPerson',
      minQuantity: 1,
      maxQuantity: 10,
      status: 'active',
      tags: ['자연', '캐년']
    },
    {
      id: '2',
      name: '호텔',
      category: 'accommodation',
      description: '호텔 숙박 옵션',
      basePrice: { adult: 50, child: 40, infant: 30 },
      priceType: 'perPerson',
      minQuantity: 1,
      maxQuantity: 5,
      status: 'active',
      tags: ['숙박', '호텔']
    },
    {
      id: '3',
      name: '도시락',
      category: 'food',
      description: '도시락 식사 옵션',
      basePrice: { adult: 15, child: 12, infant: 10 },
      priceType: 'perPerson',
      minQuantity: 0,
      maxQuantity: 10,
      status: 'active',
      tags: ['식사', '도시락']
    },
    {
      id: '4',
      name: '카시트',
      category: 'equipment',
      description: '아동용 카시트 옵션',
      basePrice: { adult: 0, child: 20, infant: 15 },
      priceType: 'perPerson',
      minQuantity: 0,
      maxQuantity: 3,
      status: 'active',
      tags: ['장비', '카시트']
    }
  ])

  // 새 상품 생성 시 기본값 설정
  useEffect(() => {
    if (isNewProduct) {
      setFormData({
        name: '',
        category: 'nature',
        description: '',
        duration: 1,
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
          { id: '1', code: 'WELCOME10', discountType: 'percentage' as const, discountValue: 10, minAmount: 100, maxDiscount: 50, validFrom: '2024-01-01', validTo: '2024-12-31', usageLimit: 1000, currentUsage: 0, isActive: true },
          { id: '2', code: 'SAVE20', discountType: 'fixed' as const, discountValue: 20, minAmount: 200, maxDiscount: 20, validFrom: '2024-01-01', validTo: '2024-12-31', usageLimit: 500, currentUsage: 0, isActive: true }
        ],
        maxParticipants: 10,
        status: 'active',
        tags: [],
        productOptions: []
      })
    }
  }, [isNewProduct])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: API 호출로 상품 저장
    console.log('상품 저장:', formData)
    alert('상품이 저장되었습니다!')
    router.push(`/${locale}/admin/products`)
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] })
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) })
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
    setFormData({ ...formData, productOptions: [...formData.productOptions, newOption] })
  }

  const removeProductOption = (optionId: string) => {
    setFormData({ ...formData, productOptions: formData.productOptions.filter(opt => opt.id !== optionId) })
  }

  const updateProductOption = (optionId: string, updates: Partial<ProductOption>) => {
    setFormData({
      ...formData,
      productOptions: formData.productOptions.map(opt =>
        opt.id === optionId ? { ...opt, ...updates } : opt
      )
    })
  }

  const addOptionChoice = (optionId: string) => {
    const newChoice: ProductOptionChoice = {
      id: `choice-${Date.now()}`,
      name: '',
      description: '',
      priceAdjustment: { adult: 0, child: 0, infant: 0 }
    }
    updateProductOption(optionId, {
      choices: [...(formData.productOptions.find(opt => opt.id === optionId)?.choices || []), newChoice]
    })
  }

  const removeOptionChoice = (optionId: string, choiceId: string) => {
    updateProductOption(optionId, {
      choices: (formData.productOptions.find(opt => opt.id === optionId)?.choices || []).filter(choice => choice.id !== choiceId)
    })
  }

  const updateOptionChoice = (optionId: string, choiceId: string, updates: Partial<ProductOptionChoice>) => {
    updateProductOption(optionId, {
      choices: (formData.productOptions.find(opt => opt.id === optionId)?.choices || []).map(choice =>
        choice.id === choiceId ? { ...choice, ...updates } : choice
      )
    })
  }

  const linkToGlobalOption = (optionId: string, globalOptionId: string) => {
    const globalOption = globalOptions.find(go => go.id === globalOptionId)
    if (globalOption) {
      updateProductOption(optionId, {
        name: globalOption.name,
        description: globalOption.description,
        linkedOptionId: globalOptionId
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
    setFormData({
      ...formData,
      channelPricing: [...formData.channelPricing, newChannel]
    })
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
    setFormData({
      ...formData,
      seasonalPricing: [...formData.seasonalPricing, newSeason]
    })
  }

  const addCoupon = () => {
    const newCoupon: Coupon = {
      id: `coupon_${Date.now()}`,
      code: 'NEW' + Math.random().toString(36).substr(2, 5).toUpperCase(),
      discountType: 'percentage',
      discountValue: 10,
      minAmount: 100,
      maxDiscount: 50,
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      usageLimit: 1000,
      currentUsage: 0,
      isActive: true
    }
    setFormData({
      ...formData,
      coupons: [...formData.coupons, newCoupon]
    })
  }

  const tabs = [
    { id: 'basic', label: '기본정보', icon: Info },
    { id: 'pricing', label: '가격관리', icon: DollarSign },
    { id: 'integrated-pricing', label: '통합 가격', icon: TrendingUp },
    { id: 'options', label: '옵션관리', icon: Settings },
    { id: 'details', label: '세부정보', icon: Tag },
    { id: 'schedule', label: '일정', icon: Calendar },
    { id: 'faq', label: 'FAQ', icon: MessageCircle },
    { id: 'media', label: '미디어', icon: Image }
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
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품명 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="city">도시</option>
                  <option value="nature">자연</option>
                  <option value="culture">문화</option>
                  <option value="adventure">모험</option>
                  <option value="food">음식</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명 *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">기간 (일) *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">최대 참가자 *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태 *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'draft' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
                <option value="draft">초안</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">태그</label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="태그 입력 후 Enter"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  추가
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 가격관리 탭 */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <DollarSign className="h-5 w-5 text-green-600 mr-2" />
              기본 가격 설정
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성인 가격 ($) *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.basePrice.adult}
                  onChange={(e) => setFormData({
                    ...formData,
                    basePrice: { ...formData.basePrice, adult: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">아동 가격 ($) *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.basePrice.child}
                  onChange={(e) => setFormData({
                    ...formData,
                    basePrice: { ...formData.basePrice, child: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유아 가격 ($) *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.basePrice.infant}
                  onChange={(e) => setFormData({
                    ...formData,
                    basePrice: { ...formData.basePrice, infant: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <h3 className="text-lg font-medium text-gray-900 flex items-center mt-8">
              <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
              채널별 가격 관리
            </h3>
            <p className="text-sm text-gray-600">
              각 판매 채널별로 가격을 다르게 설정할 수 있습니다.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500 text-center">
                채널별 가격 설정 UI는 추후 구현 예정입니다.
              </p>
            </div>
          </div>
        )}

        {/* 통합 가격 탭 */}
        {activeTab === 'integrated-pricing' && (
          <div className="space-y-8">
            {/* 1. 옵션별 가격 조정 */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
                <Settings className="h-5 w-5 text-purple-600 mr-2" />
                {t('integratedPricing.optionPricing.title')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('integratedPricing.optionPricing.description')}
              </p>
              
              {formData.productOptions.length === 0 ? (
                <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                  <Settings className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>{t('integratedPricing.optionPricing.noOptions')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.productOptions.map((option) => (
                    <div key={option.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{option.name}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            option.isRequired ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {option.isRequired ? t('integratedPricing.optionPricing.required') : t('integratedPricing.optionPricing.optional')}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            option.isMultiple ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {option.isMultiple ? t('integratedPricing.optionPricing.multiple') : t('integratedPricing.optionPricing.single')}
                          </span>
                        </div>
                      </div>
                      
                                                                      <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('integratedPricing.optionPricing.adultAdjustment')}</label>
                            <input
                              type="number"
                              value={option.priceAdjustment?.adult || 0}
                              onChange={(e) => {
                                const newProductOptions = [...formData.productOptions]
                                const optionIndex = newProductOptions.findIndex(opt => opt.id === option.id)
                                if (optionIndex !== -1) {
                                  newProductOptions[optionIndex] = {
                                    ...newProductOptions[optionIndex],
                                    priceAdjustment: {
                                      adult: parseInt(e.target.value) || 0,
                                      child: newProductOptions[optionIndex].priceAdjustment?.child || 0,
                                      infant: newProductOptions[optionIndex].priceAdjustment?.infant || 0
                                    } as { adult: number; child: number; infant: number }
                                  }
                                  setFormData({ ...formData, productOptions: newProductOptions })
                                }
                              }}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('integratedPricing.optionPricing.childAdjustment')}</label>
                            <input
                              type="number"
                              value={option.priceAdjustment?.child || 0}
                              onChange={(e) => {
                                const newProductOptions = [...formData.productOptions]
                                const optionIndex = newProductOptions.findIndex(opt => opt.id === option.id)
                                if (optionIndex !== -1) {
                                  newProductOptions[optionIndex] = {
                                    ...newProductOptions[optionIndex],
                                    priceAdjustment: {
                                      adult: newProductOptions[optionIndex].priceAdjustment?.adult || 0,
                                      child: parseInt(e.target.value) || 0,
                                      infant: newProductOptions[optionIndex].priceAdjustment?.infant || 0
                                    } as { adult: number; child: number; infant: number }
                                  }
                                  setFormData({ ...formData, productOptions: newProductOptions })
                                }
                              }}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('integratedPricing.optionPricing.infantAdjustment')}</label>
                            <input
                              type="number"
                              value={option.priceAdjustment?.infant || 0}
                              onChange={(e) => {
                                const newProductOptions = [...formData.productOptions]
                                const optionIndex = newProductOptions.findIndex(opt => opt.id === option.id)
                                if (optionIndex !== -1) {
                                  newProductOptions[optionIndex] = {
                                    ...newProductOptions[optionIndex],
                                    priceAdjustment: {
                                      adult: newProductOptions[optionIndex].priceAdjustment?.adult || 0,
                                      child: newProductOptions[optionIndex].priceAdjustment?.child || 0,
                                      infant: parseInt(e.target.value) || 0
                                    } as { adult: number; child: number; infant: number }
                                  }
                                  setFormData({ ...formData, productOptions: newProductOptions })
                                }
                              }}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. 채널별 가격 정책 */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
                  {t('integratedPricing.channelPricing.title')}
                </h3>
                <button
                  type="button"
                  onClick={addChannel}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Plus size={16} />
                  <span>{t('integratedPricing.channelPricing.addChannel')}</span>
                </button>
              </div>
              
              <div className="space-y-4">
                {formData.channelPricing.map((channel, index) => (
                  <div key={channel.channelId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={channel.isActive}
                          onChange={(e) => {
                            const newChannelPricing = [...formData.channelPricing]
                            newChannelPricing[index].isActive = e.target.checked
                            setFormData({ ...formData, channelPricing: newChannelPricing })
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <h4 className="font-medium text-gray-900">{channel.channelName}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newChannelPricing = formData.channelPricing.filter((_, i) => i !== index)
                          setFormData({ ...formData, channelPricing: newChannelPricing })
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">가격 유형</label>
                        <select
                          value={channel.pricingType}
                          onChange={(e) => {
                            const newChannelPricing = [...formData.channelPricing]
                            newChannelPricing[index].pricingType = e.target.value as 'percentage' | 'fixed' | 'multiplier'
                            setFormData({ ...formData, channelPricing: newChannelPricing })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="percentage">백분율 (%)</option>
                          <option value="fixed">고정 금액</option>
                          <option value="multiplier">배수</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">조정값</label>
                        <input
                          type="number"
                          value={channel.adjustment}
                          onChange={(e) => {
                            const newChannelPricing = [...formData.channelPricing]
                            newChannelPricing[index].adjustment = parseInt(e.target.value) || 0
                            setFormData({ ...formData, channelPricing: newChannelPricing })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                        <input
                          type="text"
                          value={channel.description}
                          onChange={(e) => {
                            const newChannelPricing = [...formData.channelPricing]
                            newChannelPricing[index].description = e.target.value
                            setFormData({ ...formData, channelPricing: newChannelPricing })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="text-sm text-gray-600">
                          {channel.pricingType === 'percentage' && (
                            <span className={`font-medium ${channel.adjustment >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {channel.adjustment >= 0 ? '+' : ''}{channel.adjustment}%
                            </span>
                          )}
                          {channel.pricingType === 'fixed' && (
                            <span className={`font-medium ${channel.adjustment >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {channel.adjustment >= 0 ? '+' : ''}${channel.adjustment}
                            </span>
                          )}
                          {channel.pricingType === 'multiplier' && (
                            <span className="font-medium text-blue-600">
                              ×{channel.adjustment}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 시즌별 가격 설정 */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Calendar className="h-5 w-5 text-green-600 mr-2" />
                  {t('integratedPricing.seasonalPricing.title')}
                </h3>
                <button
                  type="button"
                  onClick={addSeason}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                >
                  <Plus size={16} />
                  <span>{t('integratedPricing.seasonalPricing.addSeason')}</span>
                </button>
              </div>
              
              <div className="space-y-4">
                {formData.seasonalPricing.map((season, index) => (
                  <div key={season.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={season.isActive}
                          onChange={(e) => {
                            const newSeasonalPricing = [...formData.seasonalPricing]
                            newSeasonalPricing[index].isActive = e.target.checked
                            setFormData({ ...formData, seasonalPricing: newSeasonalPricing })
                          }}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <h4 className="font-medium text-gray-900">{season.name}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newSeasonalPricing = formData.seasonalPricing.filter((_, i) => i !== index)
                          setFormData({ ...formData, seasonalPricing: newSeasonalPricing })
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-5 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                        <input
                          type="date"
                          value={season.startDate}
                          onChange={(e) => {
                            const newSeasonalPricing = [...formData.seasonalPricing]
                            newSeasonalPricing[index].startDate = e.target.value
                            setFormData({ ...formData, seasonalPricing: newSeasonalPricing })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                        <input
                          type="date"
                          value={season.endDate}
                          onChange={(e) => {
                            const newSeasonalPricing = [...formData.seasonalPricing]
                            newSeasonalPricing[index].endDate = e.target.value
                            setFormData({ ...formData, seasonalPricing: newSeasonalPricing })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">가격 유형</label>
                        <select
                          value={season.pricingType}
                          onChange={(e) => {
                            const newSeasonalPricing = [...formData.seasonalPricing]
                            newSeasonalPricing[index].pricingType = e.target.value as 'percentage' | 'fixed' | 'multiplier'
                            setFormData({ ...formData, seasonalPricing: newSeasonalPricing })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="percentage">백분율 (%)</option>
                          <option value="fixed">고정 금액</option>
                          <option value="multiplier">배수</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">조정값</label>
                        <input
                          type="number"
                          value={season.adjustment}
                          onChange={(e) => {
                            const newSeasonalPricing = [...formData.seasonalPricing]
                            newSeasonalPricing[index].adjustment = parseInt(e.target.value) || 0
                            setFormData({ ...formData, seasonalPricing: newSeasonalPricing })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                        <input
                          type="text"
                          value={season.description}
                          onChange={(e) => {
                            const newSeasonalPricing = [...formData.seasonalPricing]
                            newSeasonalPricing[index].description = e.target.value
                            setFormData({ ...formData, seasonalPricing: newSeasonalPricing })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 쿠폰 관리 */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Percent className="h-5 w-5 text-orange-600 mr-2" />
                  {t('integratedPricing.couponManagement.title')}
                </h3>
                <button
                  type="button"
                  onClick={addCoupon}
                  className="bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 flex items-center space-x-2"
                >
                  <Plus size={16} />
                  <span>{t('integratedPricing.couponManagement.addCoupon')}</span>
                </button>
              </div>
              
              <div className="space-y-4">
                {formData.coupons.map((coupon, index) => (
                  <div key={coupon.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={coupon.isActive}
                          onChange={(e) => {
                            const newCoupons = [...formData.coupons]
                            newCoupons[index].isActive = e.target.checked
                            setFormData({ ...formData, coupons: newCoupons })
                          }}
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                        />
                        <h4 className="font-medium text-gray-900">{coupon.code}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newCoupons = formData.coupons.filter((_, i) => i !== index)
                          setFormData({ ...formData, coupons: newCoupons })
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">할인 유형</label>
                        <select
                          value={coupon.discountType}
                          onChange={(e) => {
                            const newCoupons = [...formData.coupons]
                            newCoupons[index].discountType = e.target.value as 'percentage' | 'fixed'
                            setFormData({ ...formData, coupons: newCoupons })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        >
                          <option value="percentage">백분율 (%)</option>
                          <option value="fixed">고정 금액</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">할인값</label>
                        <input
                          type="number"
                          value={coupon.discountValue}
                          onChange={(e) => {
                            const newCoupons = [...formData.coupons]
                            newCoupons[index].discountValue = parseInt(e.target.value) || 0
                            setFormData({ ...formData, coupons: newCoupons })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">최소 주문 금액</label>
                        <input
                          type="number"
                          value={coupon.minAmount}
                          onChange={(e) => {
                            const newCoupons = [...formData.coupons]
                            newCoupons[index].minAmount = parseInt(e.target.value) || 0
                            setFormData({ ...formData, coupons: newCoupons })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">최대 할인 금액</label>
                        <input
                          type="number"
                          value={coupon.maxDiscount}
                          onChange={(e) => {
                            const newCoupons = [...formData.coupons]
                            newCoupons[index].maxDiscount = parseInt(e.target.value) || 0
                            setFormData({ ...formData, coupons: newCoupons })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">유효 시작일</label>
                        <input
                          type="date"
                          value={coupon.validFrom}
                          onChange={(e) => {
                            const newCoupons = [...formData.coupons]
                            newCoupons[index].validFrom = e.target.value
                            setFormData({ ...formData, coupons: newCoupons })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">유효 종료일</label>
                        <input
                          type="date"
                          value={coupon.validTo}
                          onChange={(e) => {
                            const newCoupons = [...formData.coupons]
                            newCoupons[index].validTo = e.target.value
                            setFormData({ ...formData, coupons: newCoupons })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">사용 제한</label>
                        <input
                          type="number"
                          value={coupon.usageLimit}
                          onChange={(e) => {
                            const newCoupons = [...formData.coupons]
                            newCoupons[index].usageLimit = parseInt(e.target.value) || 0
                            setFormData({ ...formData, coupons: newCoupons })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. 가격 미리보기 */}
            <div className="border border-gray-200 rounded-lg p-6 bg-blue-50">
              <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
                <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                {t('integratedPricing.pricePreview.title')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('integratedPricing.pricePreview.description')}
              </p>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('integratedPricing.pricePreview.basePrice')}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{t('integratedPricing.pricePreview.adult')}:</span>
                      <span className="font-medium">${formData.basePrice.adult}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('integratedPricing.pricePreview.child')}:</span>
                      <span className="font-medium">${formData.basePrice.child}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('integratedPricing.pricePreview.infant')}:</span>
                      <span className="font-medium">${formData.basePrice.infant}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('integratedPricing.pricePreview.activeChannels')}</h4>
                  <div className="text-sm">
                    <span className="font-medium text-blue-600">
                      {formData.channelPricing.filter(c => c.isActive).length}개
                    </span>
                    <span className="text-gray-600 ml-2">{t('integratedPricing.pricePreview.channels')}</span>
                  </div>
                  
                  <h4 className="font-medium text-gray-900 mb-3 mt-4">{t('integratedPricing.pricePreview.activeSeasons')}</h4>
                  <div className="text-sm">
                    <span className="font-medium text-green-600">
                      {formData.seasonalPricing.filter(c => c.isActive).length}개
                    </span>
                    <span className="text-gray-600 ml-2">{t('integratedPricing.pricePreview.seasons')}</span>
                  </div>
                  
                  <h4 className="font-medium text-gray-900 mb-3 mt-4">{t('integratedPricing.pricePreview.activeCoupons')}</h4>
                  <div className="text-sm">
                    <span className="font-medium text-orange-600">
                      {formData.coupons.filter(c => c.isActive).length}개
                    </span>
                    <span className="text-gray-600 ml-2">{t('integratedPricing.pricePreview.coupons')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 옵션관리 탭 */}
        {activeTab === 'options' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Settings className="h-5 w-5 text-purple-600 mr-2" />
                상품 옵션 관리
              </h3>
              <button
                type="button"
                onClick={addProductOption}
                className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2"
              >
                <Plus size={16} />
                <span>옵션 추가</span>
              </button>
            </div>

            {formData.productOptions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>아직 추가된 옵션이 없습니다.</p>
                <p className="text-sm">위의 &apos;옵션 추가&apos; 버튼을 클릭하여 옵션을 추가해보세요.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.productOptions.map((option, optionIndex) => (
                  <div key={option.id} className="border border-gray-200 rounded-lg p-4">
                    {/* 옵션 헤더 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 mr-4">
                        <input
                          type="text"
                          value={option.name}
                          onChange={(e) => updateProductOption(option.id, { name: e.target.value })}
                          placeholder="옵션명"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => removeProductOption(option.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* 옵션 설정 */}
                    <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`required-${option.id}`}
                          checked={option.isRequired}
                          onChange={(e) => updateProductOption(option.id, { isRequired: e.target.checked })}
                          className="mr-1"
                        />
                        <label htmlFor={`required-${option.id}`} className="text-gray-600">필수</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`multiple-${option.id}`}
                          checked={option.isMultiple}
                          onChange={(e) => updateProductOption(option.id, { isMultiple: e.target.checked })}
                          className="mr-1"
                        />
                        <label htmlFor={`multiple-${option.id}`} className="text-gray-600">다중</label>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={option.description}
                          onChange={(e) => updateProductOption(option.id, { description: e.target.value })}
                          placeholder="설명"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* 글로벌 옵션 연결 */}
                    <div className="mb-3">
                      <select
                        value={option.linkedOptionId || ''}
                        onChange={(e) => linkToGlobalOption(option.id, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">글로벌 옵션과 연결</option>
                        {globalOptions.map(globalOpt => (
                          <option key={globalOpt.id} value={globalOpt.id}>
                            {globalOpt.name} - {globalOpt.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 옵션 선택 항목 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">선택 항목</h4>
                        <button
                          type="button"
                          onClick={() => addOptionChoice(option.id)}
                          className="text-purple-600 hover:text-purple-800 text-xs flex items-center"
                        >
                          <Plus size={12} />
                          <span>선택 항목 추가</span>
                        </button>
                      </div>
                      
                      {option.choices.map((choice, choiceIndex) => (
                        <div key={choice.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                          <input
                            type="text"
                            value={choice.name}
                            onChange={(e) => updateOptionChoice(option.id, choice.id, { name: e.target.value })}
                            placeholder="선택 항목명"
                            className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={choice.description}
                            onChange={(e) => updateOptionChoice(option.id, choice.id, { description: e.target.value })}
                            placeholder="설명"
                            className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <input
                            type="number"
                            value={choice.priceAdjustment.adult}
                            onChange={(e) => updateOptionChoice(option.id, choice.id, {
                              priceAdjustment: { ...choice.priceAdjustment, adult: parseInt(e.target.value) || 0 }
                            })}
                            placeholder="성인"
                            className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <input
                            type="number"
                            value={choice.priceAdjustment.child}
                            onChange={(e) => updateOptionChoice(option.id, choice.id, {
                              priceAdjustment: { ...choice.priceAdjustment, child: parseInt(e.target.value) || 0 }
                            })}
                            placeholder="아동"
                            className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <input
                            type="number"
                            value={choice.priceAdjustment.infant}
                            onChange={(e) => updateOptionChoice(option.id, choice.id, {
                              priceAdjustment: { ...choice.priceAdjustment, infant: parseInt(e.target.value) || 0 }
                            })}
                            placeholder="유아"
                            className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => removeOptionChoice(option.id, choice.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
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
    </div>
  )
}
