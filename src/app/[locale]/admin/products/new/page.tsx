'use client'

import React, { useState, useEffect, use, useCallback } from 'react'
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
  Save
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
// import BasicInfoTab from '@/components/product/BasicInfoTab'

interface NewProductPageProps {
  params: Promise<{ locale: string }>
}

export default function NewProductPage({ params }: NewProductPageProps) {
  const { locale } = use(params)
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  const router = useRouter()
  
  const supabase = createClientSupabase()
  const { user, loading: authLoading } = useAuth()

  // 기본 상품 정보 상태
  const [productData, setProductData] = useState({
    title: '',
    category: '',
    sub_category: '',
    duration_minutes: 0,
    max_participants: 0,
    base_price: 0,
    description: '',
    is_active: true,
    is_tour: true
  })

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // 인증 확인
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}/login`)
    }
  }, [user, authLoading, router, locale])

  // 기본 정보 저장 함수
  const handleSaveBasicInfo = async () => {
    if (!user) return

    setSaving(true)
    setSaveMessage('')

    try {
      // 필수 필드 검증
      if (!productData.title.trim()) {
        setSaveMessage('상품명을 입력해주세요.')
        return
      }
      if (!productData.category) {
        setSaveMessage('카테고리를 선택해주세요.')
        return
      }
      if (!productData.sub_category) {
        setSaveMessage('하위 카테고리를 선택해주세요.')
        return
      }
      if (productData.duration_minutes <= 0) {
        setSaveMessage('소요시간을 입력해주세요.')
        return
      }
      if (productData.max_participants <= 0) {
        setSaveMessage('최대 참가자 수를 입력해주세요.')
        return
      }
      if (productData.base_price <= 0) {
        setSaveMessage('기본 가격을 입력해주세요.')
        return
      }

      // 상품 생성
      const { data, error } = await supabase
        .from('products')
        .insert([{
          title: productData.title,
          category: productData.category,
          sub_category: productData.sub_category,
          duration_minutes: productData.duration_minutes,
          max_participants: productData.max_participants,
          base_price: productData.base_price,
          description: productData.description,
          is_active: productData.is_active,
          is_tour: productData.is_tour,
          created_by: user.id
        }])
        .select()
        .single()

      if (error) {
        console.error('상품 생성 오류:', error)
        setSaveMessage('상품 생성에 실패했습니다.')
        return
      }

      setSaveMessage('상품이 성공적으로 생성되었습니다!')
      
      // 상품 편집 페이지로 이동
      setTimeout(() => {
        router.push(`/${locale}/admin/products/${data.id}`)
      }, 1500)

    } catch (error) {
      console.error('상품 생성 오류:', error)
      setSaveMessage('상품 생성 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 로딩 중이거나 인증되지 않은 경우
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href={`/${locale}/admin/products`}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                상품 관리로 돌아가기
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">새 상품 추가</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              {saveMessage && (
                <div className={`text-sm ${saveMessage.includes('성공') ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMessage}
                </div>
              )}
              <button
                onClick={handleSaveBasicInfo}
                disabled={saving}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    기본 정보 저장
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">기본 정보</h2>
              <p className="text-sm text-gray-600">
                상품의 기본 정보를 입력하세요. 저장 후 상세 정보를 추가할 수 있습니다.
              </p>
            </div>

            {/* 기본 정보 폼 */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 상품명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상품명 *
                  </label>
                  <input
                    type="text"
                    value={productData.title}
                    onChange={(e) => setProductData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="상품명을 입력하세요"
                    required
                  />
                </div>

                {/* 카테고리 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    카테고리 *
                  </label>
                  <select
                    value={productData.category}
                    onChange={(e) => setProductData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">카테고리를 선택하세요</option>
                    <option value="city_tour">시티 투어</option>
                    <option value="nature_tour">자연 투어</option>
                    <option value="cultural_tour">문화 투어</option>
                    <option value="adventure_tour">어드벤처 투어</option>
                    <option value="food_tour">푸드 투어</option>
                    <option value="shopping_tour">쇼핑 투어</option>
                    <option value="night_tour">나이트 투어</option>
                    <option value="private_tour">프라이빗 투어</option>
                    <option value="group_tour">그룹 투어</option>
                    <option value="day_trip">데이 트립</option>
                    <option value="multi_day">멀티 데이</option>
                  </select>
                </div>

                {/* 하위 카테고리 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    하위 카테고리 *
                  </label>
                  <select
                    value={productData.sub_category}
                    onChange={(e) => setProductData(prev => ({ ...prev, sub_category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">하위 카테고리를 선택하세요</option>
                    <option value="half_day">하루 투어</option>
                    <option value="full_day">풀데이 투어</option>
                    <option value="multi_day">멀티데이 투어</option>
                    <option value="city_walking">시티 워킹</option>
                    <option value="bus_tour">버스 투어</option>
                    <option value="private_car">프라이빗 카</option>
                    <option value="group_tour">그룹 투어</option>
                    <option value="small_group">스몰 그룹</option>
                    <option value="luxury_tour">럭셔리 투어</option>
                    <option value="budget_tour">버젯 투어</option>
                  </select>
                </div>

                {/* 소요시간 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    소요시간 (분) *
                  </label>
                  <input
                    type="number"
                    value={productData.duration_minutes}
                    onChange={(e) => setProductData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: 480 (8시간)"
                    min="1"
                    required
                  />
                </div>

                {/* 최대 참가자 수 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    최대 참가자 수 *
                  </label>
                  <input
                    type="number"
                    value={productData.max_participants}
                    onChange={(e) => setProductData(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: 20"
                    min="1"
                    required
                  />
                </div>

                {/* 기본 가격 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기본 가격 (USD) *
                  </label>
                  <input
                    type="number"
                    value={productData.base_price}
                    onChange={(e) => setProductData(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: 150"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품 설명
                </label>
                <textarea
                  value={productData.description}
                  onChange={(e) => setProductData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="상품에 대한 간단한 설명을 입력하세요"
                />
              </div>

              {/* 상태 설정 */}
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={productData.is_active}
                    onChange={(e) => setProductData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">활성 상태</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={productData.is_tour}
                    onChange={(e) => setProductData(prev => ({ ...prev, is_tour: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">투어 상품</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
