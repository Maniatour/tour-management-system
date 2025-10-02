'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { FileText, Save, AlertCircle, Settings, Languages, Loader2, Sparkles } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import CommonDetailsModal from './CommonDetailsModal'
import { translateProductDetailsFields, type ProductDetailsTranslationFields } from '@/lib/translationService'
import { suggestTourDescription } from '@/lib/chatgptService'

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

  const supabase = createClientSupabase()
  const { user, loading: authLoading } = useAuth()

  // 로딩 상태는 부모 컴포넌트에서 관리
  useEffect(() => {
    setLoading(false)
  }, [])

  // 현재 언어의 상세 정보 가져오기
  const getCurrentLanguageDetails = (): ProductDetailsFields => {
    const currentLang = formData.currentLanguage || 'ko'
    const details = formData.productDetails?.[currentLang] || {
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
    
    // 디버깅: 현재 언어의 상세 정보 확인
    console.log('=== ProductDetailsTab Debug ===')
    console.log('currentLang:', currentLang)
    console.log('formData.productDetails:', formData.productDetails)
    console.log('current details:', details)
    
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

  const getValue = (field: keyof ProductDetailsFields) => {
    const currentLang = formData.currentLanguage || 'ko'
    const currentDetails = getCurrentLanguageDetails()
    const currentUseCommon = getCurrentLanguageUseCommon()
    
    // 각 필드별로 공통 정보 사용 여부 확인
    if (currentUseCommon[field]) {
      return (commonPreview?.[currentLang]?.[field] ?? '') as string
    }
    return currentDetails[field] ?? ''
  }

  const handleInputChange = (field: keyof ProductDetailsFields, value: string) => {
    const currentLang = formData.currentLanguage || 'ko'
    setFormData((prev) => ({
      ...prev,
      productDetails: {
        ...prev.productDetails,
        [currentLang]: {
          ...prev.productDetails?.[currentLang],
          [field]: value
        }
      }
    }))
  }

  const handleUseCommonChange = (field: keyof ProductDetailsFields, useCommon: boolean) => {
    const currentLang = formData.currentLanguage || 'ko'
    setFormData((prev) => {
      const currentUseCommonForField = prev.useCommonForField?.[currentLang] || {
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
        chat_announcement: false,
        tags: false
      }
      
      const newUseCommonForField = {
        ...currentUseCommonForField,
        [field]: useCommon
      }
      
      // 모든 필드가 공통 사용인지 확인
      const allFieldsUseCommon = Object.values(newUseCommonForField).every(value => value === true)
      
      return {
        ...prev,
        useCommonForField: {
          ...prev.useCommonForField,
          [currentLang]: newUseCommonForField
        },
        // 모든 필드가 공통 사용이면 전체 공통 사용으로 설정
        useCommonDetails: allFieldsUseCommon
      }
    })
  }

  // 태그 관련 핸들러 함수들
  const [newTag, setNewTag] = useState('')

  const addTag = () => {
    if (newTag.trim() && !getCurrentLanguageDetails().tags.includes(newTag.trim())) {
      const currentLang = formData.currentLanguage || 'ko'
      setFormData((prev) => ({
        ...prev,
        productDetails: {
          ...prev.productDetails,
          [currentLang]: {
            ...prev.productDetails?.[currentLang],
            tags: [...(prev.productDetails?.[currentLang]?.tags || []), newTag.trim()]
          }
        }
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    const currentLang = formData.currentLanguage || 'ko'
    setFormData((prev) => ({
      ...prev,
      productDetails: {
        ...prev.productDetails,
        [currentLang]: {
          ...prev.productDetails?.[currentLang],
          tags: (prev.productDetails?.[currentLang]?.tags || []).filter(tag => tag !== tagToRemove)
        }
      }
    }))
  }

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
        setFormData(prev => ({
          ...prev,
          productDetails: {
            ...prev.productDetails,
            en: {
              ...prev.productDetails.en,
              ...result.translatedFields
            }
          }
        }))

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
        .maybeSingle() as { data: { id: string } | null, error: unknown }

      if (selectDetailsError) {
        console.error('product_details 존재 여부 확인 오류:', selectDetailsError)
        throw new Error(`상품 세부정보 조회 실패: ${String(selectDetailsError)}`)
      }

      const detailsData = {
        product_id: productId,
        language_code: currentLang,
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
        chat_announcement: currentDetails.chat_announcement,
        tags: currentDetails.tags
      }

      if (existingDetails) {
        // 업데이트
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: detailsError } = await (supabase as any)
          .from('product_details_multilingual')
          .update({
            ...detailsData,
            updated_at: new Date().toISOString()
          })
          .eq('product_id', productId)
          .eq('language_code', currentLang)

        if (detailsError) {
          console.error('product_details 업데이트 오류:', detailsError)
          throw new Error(`상품 세부정보 업데이트 실패: ${detailsError.message}`)
        }
        console.log('product_details 업데이트 완료')
      } else {
        // 새로 생성
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: detailsError } = await (supabase as any)
          .from('product_details_multilingual')
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
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* 언어 선택 탭 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            상품 세부정보
          </h3>
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
        </div>
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {availableLanguages.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleLanguageChange(lang)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
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

      {/* 저장 버튼 및 메시지 */}
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
                // 전체 공통 사용 시 모든 언어의 모든 필드를 공통 사용으로 설정
                useCommonForField: e.target.checked ? 
                  availableLanguages.reduce((acc, lang) => {
                    acc[lang] = {
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
                      notice_info: true,
                      private_tour_info: true,
                      cancellation_policy: true,
                      chat_announcement: true,
                      tags: true
                    }
                    return acc
                  }, {} as ProductDetailsFormData['useCommonForField']) : 
                  availableLanguages.reduce((acc, lang) => {
                    acc[lang] = {
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
                    return acc
                  }, {} as ProductDetailsFormData['useCommonForField'])
              }))}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-800">sub_category 공통 세부정보 사용</span>
          </label>
          <button
            onClick={() => setIsCommonModalOpen(true)}
            className="flex items-center space-x-1 text-sm text-blue-600 hover:underline"
          >
            <Settings className="h-4 w-4" />
            <span>공통 세부정보 관리</span>
          </button>
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
                        checked={getCurrentLanguageUseCommon().slogan1}
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
              disabled={getCurrentLanguageUseCommon().slogan1}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().slogan1 ? 'bg-gray-50' : ''}`}
              placeholder={getCurrentLanguageUseCommon().slogan1 ? '공통 정보 사용' : '예: 최고의 투어 경험'}
            />
            {getCurrentLanguageUseCommon().slogan1 && commonPreview?.[formData.currentLanguage || 'ko']?.slogan1 && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview[formData.currentLanguage || 'ko'].slogan1}
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
                        checked={getCurrentLanguageUseCommon().slogan2}
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
              disabled={getCurrentLanguageUseCommon().slogan2 || false}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().slogan2 ? 'bg-gray-50' : ''}`}
              placeholder={getCurrentLanguageUseCommon().slogan2 ? '공통 정보 사용' : '예: 전문 가이드와 함께'}
            />
            {getCurrentLanguageUseCommon().slogan2 && commonPreview?.[formData.currentLanguage || 'ko']?.slogan2 && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview[formData.currentLanguage || 'ko'].slogan2}
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
                        checked={getCurrentLanguageUseCommon().slogan3 || false}
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
              disabled={getCurrentLanguageUseCommon().slogan3 || false}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().slogan3 ? 'bg-gray-50' : ''}`}
              placeholder={getCurrentLanguageUseCommon().slogan3 ? '공통 정보 사용' : '예: 잊지 못할 추억'}
            />
            {getCurrentLanguageUseCommon().slogan3 && commonPreview?.[formData.currentLanguage || 'ko']?.slogan3 && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview[formData.currentLanguage || 'ko'].slogan3}
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
                        checked={getCurrentLanguageUseCommon().description || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().description ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().description ? '공통 정보 사용' : '상품에 대한 자세한 설명을 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().description || false}
          />
          {getCurrentLanguageUseCommon().description && commonPreview?.[formData.currentLanguage || 'ko']?.description && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].description}
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
                        checked={getCurrentLanguageUseCommon().included || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().included ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().included ? '공통 정보 사용' : '포함되는 사항들을 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().included || false}
            />
            {getCurrentLanguageUseCommon().included && commonPreview?.[formData.currentLanguage || 'ko']?.included && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview[formData.currentLanguage || 'ko'].included}
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
                        checked={getCurrentLanguageUseCommon().not_included || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().not_included ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().not_included ? '공통 정보 사용' : '불포함되는 사항들을 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().not_included || false}
            />
            {getCurrentLanguageUseCommon().not_included && commonPreview?.[formData.currentLanguage || 'ko']?.not_included && (
              <div className="mt-1 text-xs text-gray-500">
                공통 정보: {commonPreview[formData.currentLanguage || 'ko'].not_included}
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
                        checked={getCurrentLanguageUseCommon().pickup_drop_info || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().pickup_drop_info ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().pickup_drop_info ? '공통 정보 사용' : '픽업 및 드롭에 대한 정보를 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().pickup_drop_info || false}
          />
          {getCurrentLanguageUseCommon().pickup_drop_info && commonPreview?.[formData.currentLanguage || 'ko']?.pickup_drop_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].pickup_drop_info}
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
                        checked={getCurrentLanguageUseCommon().luggage_info || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().luggage_info ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().luggage_info ? '공통 정보 사용' : '수하물 관련 규정 및 정보를 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().luggage_info || false}
          />
          {getCurrentLanguageUseCommon().luggage_info && commonPreview?.[formData.currentLanguage || 'ko']?.luggage_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].luggage_info}
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
                        checked={getCurrentLanguageUseCommon().tour_operation_info || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().tour_operation_info ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().tour_operation_info ? '공통 정보 사용' : '투어 운영 방식 및 특별 사항을 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().tour_operation_info || false}
          />
          {getCurrentLanguageUseCommon().tour_operation_info && commonPreview?.[formData.currentLanguage || 'ko']?.tour_operation_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].tour_operation_info}
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
                        checked={getCurrentLanguageUseCommon().preparation_info || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().preparation_info ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().preparation_info ? '공통 정보 사용' : '투어 전 준비해야 할 사항들을 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().preparation_info || false}
          />
          {getCurrentLanguageUseCommon().preparation_info && commonPreview?.[formData.currentLanguage || 'ko']?.preparation_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].preparation_info}
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
                        checked={getCurrentLanguageUseCommon().small_group_info || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().small_group_info ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().small_group_info ? '공통 정보 사용' : '소그룹 투어의 특징 및 장점을 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().small_group_info || false}
          />
          {getCurrentLanguageUseCommon().small_group_info && commonPreview?.[formData.currentLanguage || 'ko']?.small_group_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].small_group_info}
            </div>
          )}
        </div>
      </div>

      {/* 안내사항 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">안내사항</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              투어 안내사항
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={getCurrentLanguageUseCommon().notice_info || false}
                        onChange={(e) => handleUseCommonChange('notice_info', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('notice_info')}
            onChange={(e) => handleInputChange('notice_info', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().notice_info ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().notice_info ? '공통 정보 사용' : '투어 관련 안내사항을 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().notice_info || false}
          />
          {getCurrentLanguageUseCommon().notice_info && commonPreview?.[formData.currentLanguage || 'ko']?.notice_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].notice_info}
            </div>
          )}
        </div>
      </div>

      {/* 단독투어 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">단독투어 정보</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              단독투어 관련 정보
            </label>
            <label className="flex items-center text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={getCurrentLanguageUseCommon().private_tour_info || false}
                        onChange={(e) => handleUseCommonChange('private_tour_info', e.target.checked)}
                        className="mr-1"
                      />
              공통 사용
            </label>
          </div>
          <textarea
            value={getValue('private_tour_info')}
            onChange={(e) => handleInputChange('private_tour_info', e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().private_tour_info ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().private_tour_info ? '공통 정보 사용' : '단독투어 관련 특별 사항을 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().private_tour_info || false}
          />
          {getCurrentLanguageUseCommon().private_tour_info && commonPreview?.[formData.currentLanguage || 'ko']?.private_tour_info && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].private_tour_info}
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
                        checked={getCurrentLanguageUseCommon().cancellation_policy || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().cancellation_policy ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().cancellation_policy ? '공통 정보 사용' : '취소 및 환불 정책을 자세히 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().cancellation_policy || false}
          />
          {getCurrentLanguageUseCommon().cancellation_policy && commonPreview?.[formData.currentLanguage || 'ko']?.cancellation_policy && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].cancellation_policy}
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
                        checked={getCurrentLanguageUseCommon().chat_announcement || false}
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getCurrentLanguageUseCommon().chat_announcement ? 'bg-gray-50' : ''}`}
            placeholder={getCurrentLanguageUseCommon().chat_announcement ? '공통 정보 사용' : '채팅방에 표시될 공지사항을 입력해주세요'}
            disabled={getCurrentLanguageUseCommon().chat_announcement || false}
          />
          {getCurrentLanguageUseCommon().chat_announcement && commonPreview?.[formData.currentLanguage || 'ko']?.chat_announcement && (
            <div className="mt-1 text-xs text-gray-500">
              공통 정보: {commonPreview[formData.currentLanguage || 'ko'].chat_announcement}
            </div>
          )}
        </div>
      </div>

      {/* 태그 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">태그</h4>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              상품 태그
            </label>
            <label className="flex items-center text-xs text-gray-600">
              <input
                type="checkbox"
                checked={getCurrentLanguageUseCommon().tags || false}
                onChange={(e) => handleUseCommonChange('tags', e.target.checked)}
                className="mr-1"
              />
              공통 사용
            </label>
          </div>
          
          {!getCurrentLanguageUseCommon().tags ? (
            <div>
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
                {getCurrentLanguageDetails().tags.map((tag) => (
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
          ) : (
            <div className="text-gray-500 text-sm">
              공통 정보 사용 중
              {commonPreview?.[formData.currentLanguage || 'ko']?.tags && commonPreview[formData.currentLanguage || 'ko'].tags.length > 0 && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    {commonPreview[formData.currentLanguage || 'ko'].tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 공통 세부정보 관리 모달 */}
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
