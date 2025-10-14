'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { HelpCircle, Plus, Edit, Trash2, Save, AlertCircle, ChevronDown, ChevronUp, Languages, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { translateFaqFields, type FaqTranslationFields } from '@/lib/translationService'
import { suggestFAQQuestion, suggestFAQAnswer } from '@/lib/chatgptService'

interface FaqItem {
  id?: string
  product_id: string
  question: string
  answer: string
  question_en?: string
  answer_en?: string
  order_index: number
  is_active: boolean
}

interface ProductFaqTabProps {
  productId: string
  isNewProduct: boolean
  formData: Record<string, unknown>
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
}

export default function ProductFaqTab({
  productId,
  isNewProduct,
  formData,
  setFormData
}: ProductFaqTabProps) {
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set())
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [showEnglishFields, setShowEnglishFields] = useState(false)

  // 기존 FAQ 데이터 로드
  const fetchFaqs = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('product_faqs')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('order_index', { ascending: true })

      if (error) {
        console.error('Supabase 오류:', error)
        throw new Error(`데이터베이스 오류: ${error.message}`)
      }

      setFaqs(data || [])
    } catch (error) {
      console.error('FAQ 로드 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setSaveMessage(`FAQ를 불러오는데 실패했습니다: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }, [productId])

  // 기존 FAQ 데이터 로드
  useEffect(() => {
    if (!isNewProduct && productId) {
      fetchFaqs()
    } else {
      setLoading(false)
    }
  }, [productId, isNewProduct, fetchFaqs])

  const handleAddFaq = () => {
    const newFaq: FaqItem = {
      product_id: productId,
      question: '',
      answer: '',
      order_index: faqs.length,
      is_active: true
    }
    setEditingFaq(newFaq)
    setShowAddModal(true)
  }

  const handleEditFaq = (faq: FaqItem) => {
    setEditingFaq(faq)
    setShowAddModal(true)
  }

  const handleDeleteFaq = async (faqId: string) => {
    if (!confirm('이 FAQ를 삭제하시겠습니까?')) return

    try {
      const { error } = await (supabase as any)
        .from('product_faqs')
        .delete()
        .eq('id', faqId)

      if (error) throw error

      setFaqs(prev => prev.filter(f => f.id !== faqId))
      setSaveMessage('FAQ가 삭제되었습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('FAQ 삭제 오류:', error)
      setSaveMessage('FAQ 삭제에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const handleSaveFaq = async (faqData: FaqItem) => {
    setSaving(true)
    setSaveMessage('')

    try {
      if (faqData.id) {
        // 업데이트
        const { error } = await (supabase as any)
          .from('product_faqs')
          .update({
            ...faqData,
            updated_at: new Date().toISOString()
          })
          .eq('id', faqData.id)

        if (error) throw error

        setFaqs(prev => prev.map(f => f.id === faqData.id ? faqData : f))
      } else {
        // 새로 생성
        const { data, error } = await (supabase as any)
          .from('product_faqs')
          .insert([faqData])
          .select()
          .single()

        if (error) throw error

        setFaqs(prev => [...prev, data])
      }

      setSaveMessage('FAQ가 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
      setShowAddModal(false)
      setEditingFaq(null)
    } catch (error) {
      console.error('FAQ 저장 오류:', error)
      setSaveMessage('FAQ 저장에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const toggleFaqExpansion = (faqId: string) => {
    const newExpanded = new Set(expandedFaqs)
    if (newExpanded.has(faqId)) {
      newExpanded.delete(faqId)
    } else {
      newExpanded.add(faqId)
    }
    setExpandedFaqs(newExpanded)
  }

  const moveFaq = async (faqId: string, direction: 'up' | 'down') => {
    const currentIndex = faqs.findIndex(f => f.id === faqId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= faqs.length) return

    const newFaqs = [...faqs]
    const [movedFaq] = newFaqs.splice(currentIndex, 1)
    newFaqs.splice(newIndex, 0, movedFaq)

    // order_index 업데이트
    const updatedFaqs = newFaqs.map((faq, index) => ({
      ...faq,
      order_index: index
    }))

    setFaqs(updatedFaqs)

    // 데이터베이스 업데이트
    try {
      for (const faq of updatedFaqs) {
        await (supabase as any)
          .from('product_faqs')
          .update({ order_index: faq.order_index })
          .eq('id', faq.id)
      }
    } catch (error) {
      console.error('FAQ 순서 변경 오류:', error)
      setSaveMessage('FAQ 순서 변경에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  // 번역 함수
  const translateAllFaqs = async () => {
    setTranslating(true)
    setTranslationError(null)

    try {
      const updatedFaqs = [...faqs]
      
      for (let i = 0; i < faqs.length; i++) {
        const faq = faqs[i]
        
        // 번역할 필드들 수집
        const fieldsToTranslate: FaqTranslationFields = {
          question: faq.question,
          answer: faq.answer
        }

        // 번역 실행
        const result = await translateFaqFields(fieldsToTranslate)

        if (result.success && result.translatedFields) {
          // 번역된 내용을 FAQ에 적용
          updatedFaqs[i] = {
            ...updatedFaqs[i],
            question_en: result.translatedFields.question,
            answer_en: result.translatedFields.answer
          }
        } else {
          console.warn(`FAQ ${i + 1}번 번역 실패:`, result.error)
        }

        // API 제한을 고려하여 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      setFaqs(updatedFaqs)
      setSaveMessage('모든 FAQ가 번역되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('전체 FAQ 번역 오류:', error)
      setTranslationError(`번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setTranslating(false)
    }
  }

  // 개별 FAQ 번역 함수
  const translateFaq = async (faqId: string) => {
    const faqIndex = faqs.findIndex(f => f.id === faqId)
    if (faqIndex === -1) return

    setTranslating(true)
    setTranslationError(null)

    try {
      const faq = faqs[faqIndex]
      
      // 번역할 필드들 수집
      const fieldsToTranslate: FaqTranslationFields = {
        question: faq.question,
        answer: faq.answer
      }

      // 번역 실행
      const result = await translateFaqFields(fieldsToTranslate)

      if (result.success && result.translatedFields) {
        // 번역된 내용을 FAQ에 적용
        const updatedFaqs = [...faqs]
        updatedFaqs[faqIndex] = {
          ...updatedFaqs[faqIndex],
          question_en: result.translatedFields.question,
          answer_en: result.translatedFields.answer
        }
        setFaqs(updatedFaqs)
      } else {
        setTranslationError(result.error || '번역에 실패했습니다.')
      }
    } catch (error) {
      console.error('FAQ 번역 오류:', error)
      setTranslationError(`번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setTranslating(false)
    }
  }

  // ChatGPT 추천 함수들
  const suggestFAQQuestionForIndex = async (index: number) => {
    setSuggesting(true)
    setSuggestionError(null)

    try {
      const productTitle = (formData.title as string) || '투어 상품'
      const suggestedQuestion = await suggestFAQQuestion(productTitle)
      
      const updatedFaqs = [...faqs]
      updatedFaqs[index] = {
        ...updatedFaqs[index],
        question: suggestedQuestion
      }
      setFaqs(updatedFaqs)
    } catch (error) {
      console.error('ChatGPT 질문 추천 오류:', error)
      setSuggestionError(error instanceof Error ? error.message : 'ChatGPT 추천 중 오류가 발생했습니다.')
    } finally {
      setSuggesting(false)
    }
  }

  const suggestFAQAnswerForIndex = async (index: number) => {
    setSuggesting(true)
    setSuggestionError(null)

    try {
      const faq = faqs[index]
      const suggestedAnswer = await suggestFAQAnswer(faq.question)
      
      const updatedFaqs = [...faqs]
      updatedFaqs[index] = {
        ...updatedFaqs[index],
        answer: suggestedAnswer
      }
      setFaqs(updatedFaqs)
    } catch (error) {
      console.error('ChatGPT 답변 추천 오류:', error)
      setSuggestionError(error instanceof Error ? error.message : 'ChatGPT 추천 중 오류가 발생했습니다.')
    } finally {
      setSuggesting(false)
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
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <HelpCircle className="h-5 w-5 mr-2" />
          자주 묻는 질문 (FAQ)
        </h3>
        <div className="flex items-center space-x-4">
          {saveMessage && (
            <div className={`flex items-center text-sm ${
              saveMessage.includes('성공') || saveMessage.includes('저장') || saveMessage.includes('번역') ? 'text-green-600' : 'text-red-600'
            }`}>
              <AlertCircle className="h-4 w-4 mr-1" />
              {saveMessage}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowEnglishFields(!showEnglishFields)}
            className={`px-3 py-2 text-sm rounded-lg border ${
              showEnglishFields 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {showEnglishFields ? 'EN' : 'KO'}
          </button>
          <button
            type="button"
            onClick={translateAllFaqs}
            disabled={translating || faqs.length === 0}
            className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
            title="모든 FAQ를 한국어에서 영어로 번역"
          >
            {translating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Languages className="h-4 w-4 mr-1" />
            )}
            {translating ? '번역 중...' : '전체 번역'}
          </button>
          <button
            type="button"
            onClick={() => {
              // 모든 FAQ의 질문과 답변을 ChatGPT로 추천받기
              faqs.forEach((_, index) => {
                suggestFAQQuestionForIndex(index)
                suggestFAQAnswerForIndex(index)
              })
            }}
            disabled={suggesting || faqs.length === 0}
            className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
            title="모든 FAQ의 질문과 답변을 ChatGPT로 추천받기"
          >
            {suggesting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {suggesting ? '추천 중...' : 'AI 추천'}
          </button>
          <button
            type="button"
            onClick={handleAddFaq}
            disabled={isNewProduct}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-2" />
            FAQ 추가
          </button>
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

      {isNewProduct && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-yellow-800">
              새 상품의 경우 상품을 먼저 저장한 후 FAQ를 추가할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* FAQ 목록 */}
      {faqs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <HelpCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>아직 등록된 FAQ가 없습니다.</p>
          <p className="text-sm">FAQ 추가 버튼을 클릭하여 첫 번째 FAQ를 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={faq.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
                <div 
                  className="flex items-center space-x-3 flex-1 cursor-pointer"
                  onClick={() => toggleFaqExpansion(faq.id!)}
                >
                  <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                  <h4 className="text-left font-medium text-gray-900">
                    {showEnglishFields ? (faq.question_en || faq.question) : faq.question}
                  </h4>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        moveFaq(faq.id!, 'up')
                      }}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        moveFaq(faq.id!, 'down')
                      }}
                      disabled={index === faqs.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        translateFaq(faq.id!)
                      }}
                      disabled={translating}
                      className="p-1 text-purple-400 hover:text-purple-600 disabled:opacity-50"
                      title="이 FAQ를 번역"
                    >
                      <Languages className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditFaq(faq)
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteFaq(faq.id!)
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div 
                    className="cursor-pointer"
                    onClick={() => toggleFaqExpansion(faq.id!)}
                  >
                    {expandedFaqs.has(faq.id!) ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
              
              {expandedFaqs.has(faq.id!) && (
                <div className="px-6 py-4 bg-white border-t border-gray-200">
                  <div className="flex items-start space-x-3">
                    <span className="text-sm font-medium text-gray-500 mt-1">A</span>
                    <div className="flex-1">
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {showEnglishFields ? (faq.answer_en || faq.answer) : faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* FAQ 추가/편집 모달 */}
      {showAddModal && editingFaq && (
        <FaqModal
          faq={editingFaq}
          onSave={handleSaveFaq}
          onClose={() => {
            setShowAddModal(false)
            setEditingFaq(null)
          }}
          saving={saving}
        />
      )}
    </div>
  )
}

// FAQ 추가/편집 모달 컴포넌트
interface FaqModalProps {
  faq: FaqItem
  onSave: (faq: FaqItem) => void
  onClose: () => void
  saving: boolean
}

function FaqModal({ faq, onSave, onClose, saving }: FaqModalProps) {
  const [formData, setFormData] = useState<FaqItem>(faq)
  const [showEnglishFields, setShowEnglishFields] = useState(false)

  const handleSave = () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      alert('질문과 답변을 모두 입력해주세요.')
      return
    }
    onSave(formData)
  }

  const handleInputChange = (field: keyof FaqItem, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onKeyDown={handleKeyDown}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {faq.id ? 'FAQ 편집' : 'FAQ 추가'}
          </h3>
          <button
            type="button"
            onClick={() => setShowEnglishFields(!showEnglishFields)}
            className={`px-3 py-1 text-sm rounded border ${
              showEnglishFields 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {showEnglishFields ? 'EN' : 'KO'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {showEnglishFields ? '질문 (영어)' : '질문 (한국어)'} *
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={showEnglishFields ? (formData.question_en || '') : formData.question}
                onChange={(e) => handleInputChange(showEnglishFields ? 'question_en' : 'question', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={showEnglishFields ? "Enter frequently asked question in English" : "자주 묻는 질문을 입력해주세요"}
                required={!showEnglishFields}
              />
              {!showEnglishFields && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const productTitle = (formData.title as string) || '투어 상품'
                      const suggestedQuestion = await suggestFAQQuestion(productTitle)
                      handleInputChange('question', suggestedQuestion)
                    } catch (error) {
                      console.error('ChatGPT 질문 추천 오류:', error)
                    }
                  }}
                  className="px-3 py-2 text-sm bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200"
                  title="ChatGPT로 질문 추천받기"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {showEnglishFields ? '답변 (영어)' : '답변 (한국어)'} *
            </label>
            <div className="flex space-x-2">
              <textarea
                value={showEnglishFields ? (formData.answer_en || '') : formData.answer}
                onChange={(e) => handleInputChange(showEnglishFields ? 'answer_en' : 'answer', e.target.value)}
                rows={6}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={showEnglishFields ? "Enter answer in English" : "질문에 대한 답변을 입력해주세요"}
                required={!showEnglishFields}
              />
              {!showEnglishFields && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const suggestedAnswer = await suggestFAQAnswer(formData.question)
                      handleInputChange('answer', suggestedAnswer)
                    } catch (error) {
                      console.error('ChatGPT 답변 추천 오류:', error)
                    }
                  }}
                  className="px-3 py-2 text-sm bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200"
                  title="ChatGPT로 답변 추천받기"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleInputChange('is_active', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              활성화
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
