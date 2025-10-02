'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { 
  X, 
  Plus, 
  MapPin, 
  Globe, 
  Tag,
  HelpCircle,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'

type TourAttraction = Database['public']['Tables']['tour_attractions']['Row']

interface QuizModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  quizId?: string // 편집 모드일 때 사용
}

export default function GuideQuizModal({ isOpen, onClose, onSuccess, quizId }: QuizModalProps) {
  const t = useTranslations('admin')
  const supabase = createClientSupabase()
  
  const [loading, setLoading] = useState(false)
  const [attractions, setAttractions] = useState<TourAttraction[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    attraction_id: '',
    question: '',
    options: ['', '', '', ''],
    correct_answer: 0,
    explanation: '',
    difficulty: 'medium',
    language: 'ko',
    tags: [] as string[]
  })
  const [tagInput, setTagInput] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)

  // 태그 추가
  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  // 태그 제거
  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  // 선택지 업데이트
  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData(prev => ({
      ...prev,
      options: newOptions
    }))
  }

  // 선택지 추가
  const addOption = () => {
    if (formData.options.length < 6) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, '']
      }))
    }
  }

  // 선택지 제거
  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index)
      setFormData(prev => ({
        ...prev,
        options: newOptions,
        correct_answer: prev.correct_answer >= index ? Math.max(0, prev.correct_answer - 1) : prev.correct_answer
      }))
    }
  }

  // 퀴즈 저장
  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }

    if (!formData.question.trim()) {
      toast.error('문제를 입력해주세요.')
      return
    }

    const validOptions = formData.options.filter(option => option.trim())
    if (validOptions.length < 2) {
      toast.error('최소 2개의 선택지를 입력해주세요.')
      return
    }

    if (formData.correct_answer >= validOptions.length) {
      toast.error('정답을 선택해주세요.')
      return
    }

    try {
      setLoading(true)

      const quizData = {
        title: formData.title,
        description: formData.description || null,
        attraction_id: formData.attraction_id || null,
        question: formData.question,
        options: validOptions,
        correct_answer: formData.correct_answer,
        explanation: formData.explanation || null,
        difficulty: formData.difficulty,
        language: formData.language,
        tags: formData.tags.length > 0 ? formData.tags : null,
        is_active: true
      }

      if (isEditMode && quizId) {
        // 편집 모드
        const { error } = await supabase
          .from('guide_quizzes')
          .update(quizData)
          .eq('id', quizId)

        if (error) throw error
        toast.success('퀴즈가 성공적으로 수정되었습니다.')
      } else {
        // 생성 모드
        const { error } = await supabase
          .from('guide_quizzes')
          .insert(quizData)

        if (error) throw error
        toast.success('퀴즈가 성공적으로 생성되었습니다.')
      }

      onSuccess?.()
      handleClose()

    } catch (error) {
      console.error('퀴즈 저장 오류:', error)
      toast.error('퀴즈 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 모달 닫기
  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      attraction_id: '',
      question: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      explanation: '',
      difficulty: 'medium',
      language: 'ko',
      tags: []
    })
    setTagInput('')
    setIsEditMode(false)
    onClose()
  }

  // 관광지 로드
  const loadAttractions = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_attractions')
        .select('*')
        .eq('is_active', true)
        .order('name_ko')

      if (error) throw error
      setAttractions(data || [])
    } catch (error) {
      console.error('관광지 로드 오류:', error)
      toast.error('관광지 데이터를 불러오는 중 오류가 발생했습니다.')
    }
  }

  // 기존 퀴즈 데이터 로드 (편집 모드)
  const loadQuizData = async () => {
    if (!quizId) return

    try {
      const { data, error } = await supabase
        .from('guide_quizzes')
        .select('*')
        .eq('id', quizId)
        .single()

      if (error) throw error

      setFormData({
        title: data.title,
        description: data.description || '',
        attraction_id: data.attraction_id || '',
        question: data.question,
        options: Array.isArray(data.options) ? data.options : ['', '', '', ''],
        correct_answer: data.correct_answer,
        explanation: data.explanation || '',
        difficulty: data.difficulty || 'medium',
        language: data.language || 'ko',
        tags: data.tags || []
      })
      setIsEditMode(true)
    } catch (error) {
      console.error('퀴즈 데이터 로드 오류:', error)
      toast.error('퀴즈 데이터를 불러오는 중 오류가 발생했습니다.')
    }
  }

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadAttractions()
      if (quizId) {
        loadQuizData()
      }
    }
  }, [isOpen, quizId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditMode ? '퀴즈 편집' : '새 퀴즈 생성'}
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
                제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="퀴즈 제목을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                언어
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
              </select>
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="퀴즈에 대한 설명을 입력하세요"
            />
          </div>

          {/* 관광지 및 난이도 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                관광지
              </label>
              <select
                value={formData.attraction_id}
                onChange={(e) => setFormData(prev => ({ ...prev, attraction_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">관광지 선택 (선택사항)</option>
                {attractions.map(attraction => (
                  <option key={attraction.id} value={attraction.id}>
                    {attraction.name_ko}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                난이도
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="easy">쉬움</option>
                <option value="medium">보통</option>
                <option value="hard">어려움</option>
              </select>
            </div>
          </div>

          {/* 문제 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              문제 *
            </label>
            <textarea
              value={formData.question}
              onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="문제를 입력하세요"
            />
          </div>

          {/* 선택지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              선택지 *
            </label>
            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="correct_answer"
                      checked={formData.correct_answer === index}
                      onChange={() => setFormData(prev => ({ ...prev, correct_answer: index }))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {String.fromCharCode(65 + index)}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`선택지 ${String.fromCharCode(65 + index)}`}
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {formData.options.length < 6 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-4 h-4" />
                  <span>선택지 추가</span>
                </button>
              )}
            </div>
          </div>

          {/* 정답 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              정답 설명
            </label>
            <textarea
              value={formData.explanation}
              onChange={(e) => setFormData(prev => ({ ...prev, explanation: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="정답에 대한 설명을 입력하세요"
            />
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              태그
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="태그를 입력하고 Enter를 누르세요"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
