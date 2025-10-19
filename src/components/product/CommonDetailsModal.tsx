import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Save, AlertCircle, Globe } from 'lucide-react'
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
  notice_info: string
  private_tour_info: string
  cancellation_policy: string
  chat_announcement: string
  tags: string[]
}

interface MultilingualProductDetails {
  [languageCode: string]: ProductDetailsFields
}

interface CommonDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  subCategory: string
  onSave: () => void
}

export default function CommonDetailsModal({
  isOpen,
  onClose,
  subCategory,
  onSave
}: CommonDetailsModalProps) {
  const [currentLanguage, setCurrentLanguage] = useState('ko')
  const [formData, setFormData] = useState<MultilingualProductDetails>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClientSupabase()
  const { user } = useAuth()

  const availableLanguages = useMemo(() => [
    { code: 'ko', name: '한국어' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'zh', name: '中文' }
  ], [])

  // 현재 언어의 데이터 가져오기
  const getCurrentLanguageData = (): ProductDetailsFields => {
    return formData[currentLanguage] || {
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

  // 입력값 변경 핸들러
  const handleInputChange = (field: keyof ProductDetailsFields, value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentLanguage]: {
        ...prev[currentLanguage],
        [field]: value
      }
    }))
  }

  // 태그 추가/삭제 핸들러
  const [newTag, setNewTag] = useState('')
  
  const addTag = () => {
    if (newTag.trim() && !getCurrentLanguageData().tags.includes(newTag.trim())) {
      const currentData = getCurrentLanguageData()
      handleInputChange('tags', [...currentData.tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    const currentData = getCurrentLanguageData()
    handleInputChange('tags', currentData.tags.filter(tag => tag !== tagToRemove))
  }

  // 데이터 로드 함수
  const loadCommonDetails = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('product_details_common_multilingual')
        .select('*')
        .eq('sub_category', subCategory)
        .in('language_code', availableLanguages.map(lang => lang.code))

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
        setFormData(mapped)
      } else {
        // 빈 데이터로 초기화
        const emptyData: MultilingualProductDetails = {}
        availableLanguages.forEach(lang => {
          emptyData[lang.code] = {
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
        })
        setFormData(emptyData)
      }
    } catch (error) {
      console.error('Error loading common details:', error)
      setError('공통 세부정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [subCategory, supabase, availableLanguages])

  // 데이터 로드 (모달이 열릴 때만)
  useEffect(() => {
    if (isOpen && subCategory) {
      loadCommonDetails()
    }
  }, [isOpen, subCategory]) // loadCommonDetails 제거

  // 저장 핸들러
  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      // 기존 데이터 삭제
      await supabase
        .from('product_details_common_multilingual')
        .delete()
        .eq('sub_category', subCategory)

      // 새 데이터 저장
      const savePromises = Object.entries(formData).map(([langCode, data]) => {
        return supabase
          .from('product_details_common_multilingual')
          .insert({
            sub_category: subCategory,
            language_code: langCode,
            slogan1: data.slogan1,
            slogan2: data.slogan2,
            slogan3: data.slogan3,
            description: data.description,
            included: data.included,
            not_included: data.not_included,
            pickup_drop_info: data.pickup_drop_info,
            luggage_info: data.luggage_info,
            tour_operation_info: data.tour_operation_info,
            preparation_info: data.preparation_info,
            small_group_info: data.small_group_info,
            notice_info: data.notice_info,
            private_tour_info: data.private_tour_info,
            cancellation_policy: data.cancellation_policy,
            chat_announcement: data.chat_announcement,
            tags: data.tags
          })
      })

      await Promise.all(savePromises)
      
      onSave()
      onClose()
    } catch (error) {
      console.error('Error saving common details:', error)
      setError('공통 세부정보 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const currentData = getCurrentLanguageData()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              공통 세부정보 관리 - {subCategory}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 언어 탭 */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-4">
            {availableLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setCurrentLanguage(lang.code)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  currentLanguage === lang.code
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* 컨텐츠 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 슬로건 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    슬로건 1
                  </label>
                  <input
                    type="text"
                    value={currentData.slogan1}
                    onChange={(e) => handleInputChange('slogan1', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="첫 번째 슬로건을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    슬로건 2
                  </label>
                  <input
                    type="text"
                    value={currentData.slogan2}
                    onChange={(e) => handleInputChange('slogan2', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="두 번째 슬로건을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    슬로건 3
                  </label>
                  <input
                    type="text"
                    value={currentData.slogan3}
                    onChange={(e) => handleInputChange('slogan3', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="세 번째 슬로건을 입력하세요"
                  />
                </div>
              </div>

              {/* 상품 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품 설명
                </label>
                <textarea
                  value={currentData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="상품에 대한 자세한 설명을 입력하세요"
                />
              </div>

              {/* 포함/불포함 사항 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    포함 사항
                  </label>
                  <textarea
                    value={currentData.included}
                    onChange={(e) => handleInputChange('included', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="포함된 사항들을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    불포함 사항
                  </label>
                  <textarea
                    value={currentData.not_included}
                    onChange={(e) => handleInputChange('not_included', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="포함되지 않은 사항들을 입력하세요"
                  />
                </div>
              </div>

              {/* 픽업/드롭 정보 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  픽업/드롭 정보
                </label>
                <textarea
                  value={currentData.pickup_drop_info}
                  onChange={(e) => handleInputChange('pickup_drop_info', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="픽업 및 드롭 관련 정보를 입력하세요"
                />
              </div>

              {/* 수하물 정보 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  수하물 정보
                </label>
                <textarea
                  value={currentData.luggage_info}
                  onChange={(e) => handleInputChange('luggage_info', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="수하물 관련 정보를 입력하세요"
                />
              </div>

              {/* 투어 운영 정보 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  투어 운영 정보
                </label>
                <textarea
                  value={currentData.tour_operation_info}
                  onChange={(e) => handleInputChange('tour_operation_info', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="투어 운영 관련 정보를 입력하세요"
                />
              </div>

              {/* 준비사항 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  준비사항
                </label>
                <textarea
                  value={currentData.preparation_info}
                  onChange={(e) => handleInputChange('preparation_info', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="투어 준비사항을 입력하세요"
                />
              </div>

              {/* 소그룹 정보 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  소그룹 정보
                </label>
                <textarea
                  value={currentData.small_group_info}
                  onChange={(e) => handleInputChange('small_group_info', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="소그룹 투어 관련 정보를 입력하세요"
                />
              </div>

              {/* 안내사항 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  안내사항
                </label>
                <textarea
                  value={currentData.notice_info}
                  onChange={(e) => handleInputChange('notice_info', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="투어 관련 안내사항을 입력하세요"
                />
              </div>

              {/* 단독투어 정보 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  단독투어 정보
                </label>
                <textarea
                  value={currentData.private_tour_info}
                  onChange={(e) => handleInputChange('private_tour_info', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="단독투어 관련 특별 사항을 입력하세요"
                />
              </div>

              {/* 취소 정책 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  취소 정책
                </label>
                <textarea
                  value={currentData.cancellation_policy}
                  onChange={(e) => handleInputChange('cancellation_policy', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="취소 및 환불 정책을 입력하세요"
                />
              </div>

              {/* 채팅 공지 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  채팅 공지
                </label>
                <textarea
                  value={currentData.chat_announcement}
                  onChange={(e) => handleInputChange('chat_announcement', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="채팅 공지사항을 입력하세요"
                />
              </div>

              {/* 태그 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품 태그
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="태그를 입력하고 Enter를 누르세요"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    추가
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>저장 중...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>저장</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
