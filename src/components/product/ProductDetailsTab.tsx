'use client'

import React, { useState, useEffect } from 'react'
import { FileText, Save, AlertCircle } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

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
  companion_info: string
  exclusive_booking_info: string
  cancellation_policy: string
  chat_announcement: string
}

interface ProductDetailsFormData {
  useCommonDetails: boolean
  productDetails: ProductDetailsFields
  // 각 필드별 공통 정보 사용 여부
  useCommonForField: {
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
    companion_info: boolean
    exclusive_booking_info: boolean
    cancellation_policy: boolean
    chat_announcement: boolean
  }
}

interface ProductDetailsTabProps {
  productId: string
  isNewProduct: boolean
  locale: string
  subCategory: string
  formData: ProductDetailsFormData
  setFormData: React.Dispatch<React.SetStateAction<ProductDetailsFormData>>
}

export default function ProductDetailsTab({
  productId,
  isNewProduct,
  locale,
  subCategory,
  formData,
  setFormData
}: ProductDetailsTabProps) {
  // formData는 props로 받아서 사용

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [commonPreview, setCommonPreview] = useState<ProductDetailsFields | null>(null)
  // const [loadingCommon, setLoadingCommon] = useState(false)

  const supabase = createClientSupabase()
  const { user, loading: authLoading } = useAuth()

  // 로딩 상태는 부모 컴포넌트에서 관리
  useEffect(() => {
    setLoading(false)
  }, [])

  // 공통 세부정보 프리뷰 로드
  useEffect(() => {
    const loadCommon = async () => {
      if (!formData.useCommonDetails || !subCategory) {
        setCommonPreview(null)
        return
      }
      // setLoadingCommon(true)
      try {
        const { data, error } = await supabase
          .from('product_details_common')
          .select('*')
          .eq('sub_category', subCategory)
          .maybeSingle()

        if (error) throw error

        if (data) {
          const mapped: ProductDetailsFields = {
            slogan1: data.slogan1 || '',
            slogan2: data.slogan2 || '',
            slogan3: data.slogan3 || '',
            description: data.description || '',
            included: data.included || '',
            not_included: data.not_included || '',
            pickup_drop_info: data.pickup_drop_info || '',
            luggage_info: data.luggage_info || '',
            tour_operation_info: data.tour_operation_info || '',
            preparation_info: data.preparation_info || '',
            small_group_info: data.small_group_info || '',
            companion_info: data.companion_info || '',
            exclusive_booking_info: data.exclusive_booking_info || '',
            cancellation_policy: data.cancellation_policy || '',
            chat_announcement: data.chat_announcement || ''
          }
          setCommonPreview(mapped)
        } else {
          setCommonPreview(null)
        }
      } catch {
        setCommonPreview(null)
      } finally {
        // setLoadingCommon(false)
      }
    }
    loadCommon()
  }, [formData.useCommonDetails, subCategory, supabase])

  const getValue = (field: keyof ProductDetailsFields) => {
    // 각 필드별로 공통 정보 사용 여부 확인
    if (formData.useCommonForField?.[field]) {
      return (commonPreview?.[field] ?? '') as string
    }
    return formData.productDetails[field]
  }

  const handleInputChange = (field: keyof ProductDetailsFields, value: string) => {
    setFormData((prev) => ({
      ...prev,
      productDetails: {
        ...prev.productDetails,
        [field]: value
      }
    }))
  }

  const handleUseCommonChange = (field: keyof ProductDetailsFields, useCommon: boolean) => {
    setFormData((prev) => {
      const currentUseCommonForField = prev.useCommonForField || {
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
        companion_info: false,
        exclusive_booking_info: false,
        cancellation_policy: false,
        chat_announcement: false
      }
      
      const newUseCommonForField = {
        ...currentUseCommonForField,
        [field]: useCommon
      }
      
      // 모든 필드가 공통 사용인지 확인
      const allFieldsUseCommon = Object.values(newUseCommonForField).every(value => value === true)
      
      return {
        ...prev,
        useCommonForField: newUseCommonForField,
        // 모든 필드가 공통 사용이면 전체 공통 사용으로 설정
        useCommonDetails: allFieldsUseCommon
      }
    })
  }

  const handleSave = async () => {
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
      
      const { data: existingDetails, error: selectDetailsError } = await supabase
        .from('product_details')
        .select('id')
        .eq('product_id', productId)
        .maybeSingle()

      if (selectDetailsError) {
        console.error('product_details 존재 여부 확인 오류:', selectDetailsError)
        throw new Error(`상품 세부정보 조회 실패: ${selectDetailsError.message}`)
      }

      const detailsData = {
        product_id: productId,
        slogan1: formData.productDetails.slogan1,
        slogan2: formData.productDetails.slogan2,
        slogan3: formData.productDetails.slogan3,
        description: formData.productDetails.description,
        included: formData.productDetails.included,
        not_included: formData.productDetails.not_included,
        pickup_drop_info: formData.productDetails.pickup_drop_info,
        luggage_info: formData.productDetails.luggage_info,
        tour_operation_info: formData.productDetails.tour_operation_info,
        preparation_info: formData.productDetails.preparation_info,
        small_group_info: formData.productDetails.small_group_info,
        companion_info: formData.productDetails.companion_info,
        exclusive_booking_info: formData.productDetails.exclusive_booking_info,
        cancellation_policy: formData.productDetails.cancellation_policy,
        chat_announcement: formData.productDetails.chat_announcement
      }

      if (existingDetails) {
        // 업데이트
        const { error: detailsError } = await supabase
          .from('product_details')
          .update({
            ...detailsData,
            updated_at: new Date().toISOString()
          })
          .eq('product_id', productId)

        if (detailsError) {
          console.error('product_details 업데이트 오류:', detailsError)
          throw new Error(`상품 세부정보 업데이트 실패: ${detailsError.message}`)
        }
        console.log('product_details 업데이트 완료')
      } else {
        // 새로 생성
        const { error: detailsError } = await supabase
          .from('product_details')
          .insert([detailsData])

        if (detailsError) {
          console.error('product_details 생성 오류:', detailsError)
          throw new Error(`상품 세부정보 생성 실패: ${detailsError.message}`)
        }
        console.log('product_details 생성 완료')
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
        <span className="ml-2 text-gray-600">로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* 저장 버튼 및 메시지 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          상품 세부정보
        </h3>
        <div className="flex items-center space-x-4">
          {saveMessage && (
            <div className={`flex items-center text-sm ${
              saveMessage.includes('성공') ? 'text-green-600' : 'text-red-600'
            }`}>
              <AlertCircle className="h-4 w-4 mr-1" />
              {saveMessage}
            </div>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isNewProduct || formData.useCommonDetails}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 공통 세부정보 토글/안내 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={!!formData.useCommonDetails}
              onChange={(e) => setFormData((prev: ProductDetailsFormData) => ({ 
                ...prev, 
                useCommonDetails: e.target.checked,
                // 전체 공통 사용 시 모든 필드를 공통 사용으로 설정
                useCommonForField: e.target.checked ? {
                  slogan1: true,
                  slogan2: true,
                  slogan3: true,
                  description: true,
                  included: true,
                  not_included: true,
                  pickup_drop_info: true,
                  luggage_info: true,
                  tour_operation_info: true,
                  preparation_info: true,
                  small_group_info: true,
                  companion_info: true,
                  exclusive_booking_info: true,
                  cancellation_policy: true,
                  chat_announcement: true
                } : {
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
                  companion_info: false,
                  exclusive_booking_info: false,
                  cancellation_policy: false,
                  chat_announcement: false
                }
              }))}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-800">sub_category 공통 세부정보 사용</span>
          </label>
          <a
            href={`/${locale}/admin/products/common-details`}
            className="text-sm text-blue-600 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            공통 세부정보 관리 열기
          </a>
        </div>
        {formData.useCommonDetails && (
          <p className="mt-2 text-sm text-gray-600">
            공통 세부정보 사용 중입니다. 아래 입력 필드는 읽기 전용으로 표시됩니다.
          </p>
        )}
      </div>

      {/* 슬로건 섹션 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">슬로건</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                슬로건 1
              </label>
              <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.slogan1 || false}
                        onChange={(e) => handleUseCommonChange('slogan1', e.target.checked)}
                        className="mr-1"
                      />
                공통 사용
              </label>
            </div>
            <input
              type="text"
              value={getValue('slogan1')}
              onChange={(e) => handleInputChange('slogan1', e.target.value)}
              disabled={formData.useCommonForField?.slogan1 || false}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.slogan1 ? 'bg-gray-50' : ''}`}
              placeholder={formData.useCommonForField?.slogan1 ? '공통 정보 사용' : '예: 최고의 투어 경험'}
            />
            {formData.useCommonForField?.slogan1 && commonPreview?.slogan1 && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview.slogan1}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                슬로건 2
              </label>
              <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.slogan2 || false}
                        onChange={(e) => handleUseCommonChange('slogan2', e.target.checked)}
                        className="mr-1"
                      />
                공통 사용
              </label>
            </div>
            <input
              type="text"
              value={getValue('slogan2')}
              onChange={(e) => handleInputChange('slogan2', e.target.value)}
              disabled={formData.useCommonForField?.slogan2 || false}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.slogan2 ? 'bg-gray-50' : ''}`}
              placeholder={formData.useCommonForField?.slogan2 ? '공통 정보 사용' : '예: 전문 가이드와 함께'}
            />
            {formData.useCommonForField?.slogan2 && commonPreview?.slogan2 && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview.slogan2}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                슬로건 3
              </label>
              <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.slogan3 || false}
                        onChange={(e) => handleUseCommonChange('slogan3', e.target.checked)}
                        className="mr-1"
                      />
                공통 사용
              </label>
            </div>
            <input
              type="text"
              value={getValue('slogan3')}
              onChange={(e) => handleInputChange('slogan3', e.target.value)}
              disabled={formData.useCommonForField?.slogan3 || false}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.slogan3 ? 'bg-gray-50' : ''}`}
              placeholder={formData.useCommonForField?.slogan3 ? '공통 정보 사용' : '예: 잊지 못할 추억'}
            />
            {formData.useCommonForField?.slogan3 && commonPreview?.slogan3 && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview.slogan3}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상품 설명 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">상품 설명</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              상세 설명
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.description || false}
                        onChange={(e) => handleUseCommonChange('description', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('description')}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.description ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.description ? '공통 정보 사용' : '상품에 대한 자세한 설명을 입력해주세요'}
            disabled={formData.useCommonForField?.description || false}
          />
          {formData.useCommonForField?.description && commonPreview?.description && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.description}
            </div>
          )}
        </div>
      </div>

      {/* 포함/불포함 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">포함/불포함 정보</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                포함 사항
              </label>
              <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.included || false}
                        onChange={(e) => handleUseCommonChange('included', e.target.checked)}
                        className="mr-1"
                      />
                공통 사용
              </label>
            </div>
            <textarea
              value={getValue('included')}
              onChange={(e) => handleInputChange('included', e.target.value)}
              rows={4}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.included ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.included ? '공통 정보 사용' : '포함되는 사항들을 입력해주세요'}
            disabled={formData.useCommonForField?.included || false}
            />
            {formData.useCommonForField?.included && commonPreview?.included && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview.included}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                불포함 사항
              </label>
              <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.not_included || false}
                        onChange={(e) => handleUseCommonChange('not_included', e.target.checked)}
                        className="mr-1"
                      />
                공통 사용
              </label>
            </div>
            <textarea
              value={getValue('not_included')}
              onChange={(e) => handleInputChange('not_included', e.target.value)}
              rows={4}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.not_included ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.not_included ? '공통 정보 사용' : '불포함되는 사항들을 입력해주세요'}
            disabled={formData.useCommonForField?.not_included || false}
            />
            {formData.useCommonForField?.not_included && commonPreview?.not_included && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview.not_included}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 픽업/드롭 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">픽업/드롭 정보</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              픽업 및 드롭 정보
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.pickup_drop_info || false}
                        onChange={(e) => handleUseCommonChange('pickup_drop_info', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('pickup_drop_info')}
            onChange={(e) => handleInputChange('pickup_drop_info', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.pickup_drop_info ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.pickup_drop_info ? '공통 정보 사용' : '픽업 및 드롭에 대한 정보를 입력해주세요'}
            disabled={formData.useCommonForField?.pickup_drop_info || false}
          />
          {formData.useCommonForField?.pickup_drop_info && commonPreview?.pickup_drop_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.pickup_drop_info}
            </div>
          )}
        </div>
      </div>

      {/* 수하물 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">수하물 정보</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              수하물 관련 정보
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.luggage_info || false}
                        onChange={(e) => handleUseCommonChange('luggage_info', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('luggage_info')}
            onChange={(e) => handleInputChange('luggage_info', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.luggage_info ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.luggage_info ? '공통 정보 사용' : '수하물 관련 규정 및 정보를 입력해주세요'}
            disabled={formData.useCommonForField?.luggage_info || false}
          />
          {formData.useCommonForField?.luggage_info && commonPreview?.luggage_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.luggage_info}
            </div>
          )}
        </div>
      </div>

      {/* 투어 운영 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">투어 운영 정보</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              투어 운영 관련 정보
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.tour_operation_info || false}
                        onChange={(e) => handleUseCommonChange('tour_operation_info', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('tour_operation_info')}
            onChange={(e) => handleInputChange('tour_operation_info', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.tour_operation_info ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.tour_operation_info ? '공통 정보 사용' : '투어 운영 방식 및 특별 사항을 입력해주세요'}
            disabled={formData.useCommonForField?.tour_operation_info || false}
          />
          {formData.useCommonForField?.tour_operation_info && commonPreview?.tour_operation_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.tour_operation_info}
            </div>
          )}
        </div>
      </div>

      {/* 준비 사항 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">준비 사항</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              준비해야 할 사항들
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.preparation_info || false}
                        onChange={(e) => handleUseCommonChange('preparation_info', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('preparation_info')}
            onChange={(e) => handleInputChange('preparation_info', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.preparation_info ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.preparation_info ? '공통 정보 사용' : '투어 전 준비해야 할 사항들을 입력해주세요'}
            disabled={formData.useCommonForField?.preparation_info || false}
          />
          {formData.useCommonForField?.preparation_info && commonPreview?.preparation_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.preparation_info}
            </div>
          )}
        </div>
      </div>

      {/* 소그룹 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">소그룹 정보</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              소그룹 투어 관련 정보
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.small_group_info || false}
                        onChange={(e) => handleUseCommonChange('small_group_info', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('small_group_info')}
            onChange={(e) => handleInputChange('small_group_info', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.small_group_info ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.small_group_info ? '공통 정보 사용' : '소그룹 투어의 특징 및 장점을 입력해주세요'}
            disabled={formData.useCommonForField?.small_group_info || false}
          />
          {formData.useCommonForField?.small_group_info && commonPreview?.small_group_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.small_group_info}
            </div>
          )}
        </div>
      </div>

      {/* 동반자 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">동반자 정보</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              동반자 관련 정보
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.companion_info || false}
                        onChange={(e) => handleUseCommonChange('companion_info', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('companion_info')}
            onChange={(e) => handleInputChange('companion_info', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.companion_info ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.companion_info ? '공통 정보 사용' : '동반자 관련 규정 및 정보를 입력해주세요'}
            disabled={formData.useCommonForField?.companion_info || false}
          />
          {formData.useCommonForField?.companion_info && commonPreview?.companion_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.companion_info}
            </div>
          )}
        </div>
      </div>

      {/* 독점 예약 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">독점 예약 정보</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              독점 예약 관련 정보
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.exclusive_booking_info || false}
                        onChange={(e) => handleUseCommonChange('exclusive_booking_info', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('exclusive_booking_info')}
            onChange={(e) => handleInputChange('exclusive_booking_info', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.exclusive_booking_info ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.exclusive_booking_info ? '공통 정보 사용' : '독점 예약 관련 특별 사항을 입력해주세요'}
            disabled={formData.useCommonForField?.exclusive_booking_info || false}
          />
          {formData.useCommonForField?.exclusive_booking_info && commonPreview?.exclusive_booking_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.exclusive_booking_info}
            </div>
          )}
        </div>
      </div>

      {/* 취소 정책 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">취소 정책</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              취소 및 환불 정책
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.cancellation_policy || false}
                        onChange={(e) => handleUseCommonChange('cancellation_policy', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('cancellation_policy')}
            onChange={(e) => handleInputChange('cancellation_policy', e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.cancellation_policy ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.cancellation_policy ? '공통 정보 사용' : '취소 및 환불 정책을 자세히 입력해주세요'}
            disabled={formData.useCommonForField?.cancellation_policy || false}
          />
          {formData.useCommonForField?.cancellation_policy && commonPreview?.cancellation_policy && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.cancellation_policy}
            </div>
          )}
        </div>
      </div>

      {/* 채팅 공지 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">채팅 공지</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              채팅방 공지사항
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.useCommonForField?.chat_announcement || false}
                        onChange={(e) => handleUseCommonChange('chat_announcement', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('chat_announcement')}
            onChange={(e) => handleInputChange('chat_announcement', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.useCommonForField?.chat_announcement ? 'bg-gray-50' : ''}`}
            placeholder={formData.useCommonForField?.chat_announcement ? '공통 정보 사용' : '채팅방에 표시될 공지사항을 입력해주세요'}
            disabled={formData.useCommonForField?.chat_announcement || false}
          />
          {formData.useCommonForField?.chat_announcement && commonPreview?.chat_announcement && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview.chat_announcement}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
