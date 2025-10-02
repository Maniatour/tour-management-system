'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { 
  X, 
  MapPin, 
  Clock,
  Tag,
  Globe
} from 'lucide-react'
import { toast } from 'sonner'

interface AttractionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  attractionId?: string // 편집 모드일 때 사용
}

export default function AttractionModal({ isOpen, onClose, onSuccess, attractionId }: AttractionModalProps) {
  const t = useTranslations('admin')
  const supabase = createClientSupabase()
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name_ko: '',
    name_en: '',
    description_ko: '',
    description_en: '',
    location: '',
    category: '',
    visit_duration: 60
  })
  const [isEditMode, setIsEditMode] = useState(false)

  // 관광지 저장
  const handleSave = async () => {
    if (!formData.name_ko.trim()) {
      toast.error('한국어 관광지명을 입력해주세요.')
      return
    }

    if (!formData.name_en.trim()) {
      toast.error('영어 관광지명을 입력해주세요.')
      return
    }

    try {
      setLoading(true)

      const attractionData = {
        name_ko: formData.name_ko,
        name_en: formData.name_en,
        description_ko: formData.description_ko || null,
        description_en: formData.description_en || null,
        location: formData.location || null,
        category: formData.category || null,
        visit_duration: formData.visit_duration,
        is_active: true
      }

      if (isEditMode && attractionId) {
        // 편집 모드
        const { error } = await supabase
          .from('tour_attractions')
          .update(attractionData)
          .eq('id', attractionId)

        if (error) throw error
        toast.success('관광지가 성공적으로 수정되었습니다.')
      } else {
        // 생성 모드
        const { error } = await supabase
          .from('tour_attractions')
          .insert(attractionData)

        if (error) throw error
        toast.success('관광지가 성공적으로 생성되었습니다.')
      }

      onSuccess?.()
      handleClose()

    } catch (error) {
      console.error('관광지 저장 오류:', error)
      toast.error('관광지 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 모달 닫기
  const handleClose = () => {
    setFormData({
      name_ko: '',
      name_en: '',
      description_ko: '',
      description_en: '',
      location: '',
      category: '',
      visit_duration: 60
    })
    setIsEditMode(false)
    onClose()
  }

  // 기존 관광지 데이터 로드 (편집 모드)
  const loadAttractionData = async () => {
    if (!attractionId) return

    try {
      const { data, error } = await supabase
        .from('tour_attractions')
        .select('*')
        .eq('id', attractionId)
        .single()

      if (error) throw error

      setFormData({
        name_ko: data.name_ko,
        name_en: data.name_en,
        description_ko: data.description_ko || '',
        description_en: data.description_en || '',
        location: data.location || '',
        category: data.category || '',
        visit_duration: data.visit_duration || 60
      })
      setIsEditMode(true)
    } catch (error) {
      console.error('관광지 데이터 로드 오류:', error)
      toast.error('관광지 데이터를 불러오는 중 오류가 발생했습니다.')
    }
  }

  // 모달이 열릴 때 데이터 로드
  React.useEffect(() => {
    if (isOpen && attractionId) {
      loadAttractionData()
    }
  }, [isOpen, attractionId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditMode ? '관광지 편집' : '새 관광지 추가'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                한국어 관광지명 *
              </label>
              <input
                type="text"
                value={formData.name_ko}
                onChange={(e) => setFormData(prev => ({ ...prev, name_ko: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 경복궁"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                영어 관광지명 *
              </label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: Gyeongbokgung Palace"
              />
            </div>
          </div>

          {/* 설명 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                한국어 설명
              </label>
              <textarea
                value={formData.description_ko}
                onChange={(e) => setFormData(prev => ({ ...prev, description_ko: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="관광지에 대한 한국어 설명을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                영어 설명
              </label>
              <textarea
                value={formData.description_en}
                onChange={(e) => setFormData(prev => ({ ...prev, description_en: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter English description of the attraction"
              />
            </div>
          </div>

          {/* 위치 및 카테고리 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                위치
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 서울특별시 종로구"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">카테고리 선택</option>
                <option value="문화재">문화재</option>
                <option value="자연">자연</option>
                <option value="체험">체험</option>
                <option value="쇼핑">쇼핑</option>
                <option value="전망대">전망대</option>
                <option value="공원">공원</option>
                <option value="박물관">박물관</option>
                <option value="기타">기타</option>
              </select>
            </div>
          </div>

          {/* 체류 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              평균 체류 시간 (분)
            </label>
            <input
              type="number"
              min="1"
              max="480"
              value={formData.visit_duration}
              onChange={(e) => setFormData(prev => ({ ...prev, visit_duration: parseInt(e.target.value) || 60 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="60"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            <span>{loading ? '저장 중...' : (isEditMode ? '수정' : '생성')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
