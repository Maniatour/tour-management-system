'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { HelpCircle, Plus, Edit, Trash2, Save, AlertCircle, ChevronDown, ChevronUp, Languages, Loader2, Sparkles } from 'lucide-react'
import ContentLibraryLocaleBadges from '@/components/admin/ContentLibraryLocaleBadges'
import { supabase } from '@/lib/supabase'
import { translateFaqFields, type FaqTranslationFields } from '@/lib/translationService'
import { suggestFAQQuestion, suggestFAQAnswer } from '@/lib/chatgptService'
import LocaleDropdown from '@/components/LocaleDropdown'
import {
  getFaqLocalizedText,
  mergeFaqI18n,
  resolveFaqEditorDraftForLocale,
  type FaqContentI18n,
} from '@/lib/productFaqLocales'
import { getSiteLocaleMeta, type SiteLocale } from '@/lib/siteLocales'
import {
  fetchFaqLibrary,
  fetchProductAttachedFaqs,
  getFaqFilledLocales,
  type FaqLibraryItem,
} from '@/lib/reusableContentLibrary'

interface FaqItem {
  /** faq_library.id */
  id?: string
  /** product_faq_links.id */
  link_id?: string
  product_id: string
  name?: string
  question: string
  answer: string
  question_en?: string | null
  answer_en?: string | null
  content_i18n?: FaqContentI18n | null
  order_index: number
  is_active: boolean
}

interface ProductFaqTabProps {
  productId: string
  isNewProduct: boolean
  formData: Record<string, unknown>
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  onMutated?: () => void
  /** When rendered inside another modal, raise nested dialog z-index */
  embedded?: boolean
}

export default function ProductFaqTab({
  productId,
  isNewProduct,
  formData: _formData,
  setFormData: _setFormData,
  onMutated,
  embedded = false,
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
  const [viewLocale, setViewLocale] = useState<SiteLocale>('ko')
  const [showLibraryPicker, setShowLibraryPicker] = useState(false)
  const [libraryItems, setLibraryItems] = useState<FaqLibraryItem[]>([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set())

  const notifyMutated = useCallback(() => {
    onMutated?.()
  }, [onMutated])

  // 기존 FAQ 데이터 로드 (재사용 라이브러리 + 상품 연결)
  const fetchFaqs = useCallback(async () => {
    try {
      const attached = await fetchProductAttachedFaqs(supabase as never, productId)
      setFaqs(
        attached.map((row) => {
          const item: FaqItem = {
            id: row.id,
            link_id: row.link_id,
            product_id: row.product_id,
            name: row.name,
            question: row.question,
            answer: row.answer,
            order_index: row.order_index,
            is_active: row.is_active !== false,
          }
          if (row.question_en != null) item.question_en = row.question_en
          if (row.answer_en != null) item.answer_en = row.answer_en
          if (row.content_i18n != null) item.content_i18n = row.content_i18n
          return item
        })
      )
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
    const target = faqs.find((f) => f.id === faqId)
    if (!target?.link_id) return
    if (!confirm('이 상품에서 FAQ 연결을 해제하시겠습니까?\n(라이브러리 원본은 유지되며 다른 상품에는 영향이 없습니다.)')) return

    try {
      const { error } = await (supabase as any)
        .from('product_faq_links')
        .delete()
        .eq('id', target.link_id)

      if (error) throw error

      setFaqs(prev => prev.filter(f => f.id !== faqId))
      setSaveMessage('FAQ 연결이 해제되었습니다.')
      notifyMutated()
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('FAQ 삭제 오류:', error)
      setSaveMessage('FAQ 연결 해제에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const handleSaveFaq = async (faqData: FaqItem) => {
    setSaving(true)
    setSaveMessage('')

    try {
      const name =
        (faqData.name || '').trim() ||
        (faqData.question || '').trim().slice(0, 120) ||
        'FAQ'

      const libraryPayload = {
        name,
        question: faqData.question,
        answer: faqData.answer,
        question_en: faqData.question_en ?? null,
        answer_en: faqData.answer_en ?? null,
        content_i18n: faqData.content_i18n ?? {},
        is_active: faqData.is_active !== false,
        updated_at: new Date().toISOString(),
      }

      if (faqData.id) {
        const { error } = await (supabase as any)
          .from('faq_library')
          .update(libraryPayload)
          .eq('id', faqData.id)

        if (error) throw error

        if (faqData.link_id) {
          await (supabase as any)
            .from('product_faq_links')
            .update({
              order_index: faqData.order_index,
              is_active: faqData.is_active !== false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', faqData.link_id)
        }

        setFaqs(prev => prev.map(f => f.id === faqData.id ? { ...faqData, name } : f))
      } else {
        const { data: created, error } = await (supabase as any)
          .from('faq_library')
          .insert([libraryPayload])
          .select()
          .single()

        if (error) throw error

        const { data: link, error: linkError } = await (supabase as any)
          .from('product_faq_links')
          .insert([{
            product_id: productId,
            faq_id: created.id,
            order_index: faqData.order_index,
            is_active: true,
          }])
          .select()
          .single()

        if (linkError) throw linkError

        setFaqs(prev => [...prev, {
          ...faqData,
          id: created.id,
          link_id: link.id,
          name,
          question: created.question,
          answer: created.answer,
          question_en: created.question_en,
          answer_en: created.answer_en,
          content_i18n: created.content_i18n,
        }])
      }

      setSaveMessage('FAQ가 저장되었습니다! (재사용 라이브러리에 반영)')
      notifyMutated()
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

  const openLibraryPicker = async () => {
    setShowLibraryPicker(true)
    setSelectedLibraryIds(new Set())
    setLibraryLoading(true)
    try {
      const rows = await fetchFaqLibrary(supabase as never, {
        activeOnly: true,
        search: librarySearch,
      })
      const attachedIds = new Set(faqs.map((f) => f.id).filter(Boolean))
      setLibraryItems(rows.filter((row) => !attachedIds.has(row.id)))
    } catch (error) {
      console.error('FAQ library load error:', error)
      setSaveMessage('FAQ 라이브러리를 불러오지 못했습니다.')
    } finally {
      setLibraryLoading(false)
    }
  }

  const toggleLibrarySelection = (faqId: string) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev)
      if (next.has(faqId)) next.delete(faqId)
      else next.add(faqId)
      return next
    })
  }

  const toggleSelectAllLibrary = () => {
    setSelectedLibraryIds((prev) => {
      if (prev.size === libraryItems.length) return new Set()
      return new Set(libraryItems.map((item) => item.id))
    })
  }

  const attachSelectedLibraryFaqs = async () => {
    const selectedItems = libraryItems.filter((row) => selectedLibraryIds.has(row.id))
    if (selectedItems.length === 0) {
      setSaveMessage('추가할 FAQ를 하나 이상 선택해주세요.')
      setTimeout(() => setSaveMessage(''), 3000)
      return
    }

    try {
      const inserts = selectedItems.map((item, idx) => ({
        product_id: productId,
        faq_id: item.id,
        order_index: faqs.length + idx,
        is_active: true,
      }))

      const { data: links, error } = await (supabase as any)
        .from('product_faq_links')
        .insert(inserts)
        .select()
      if (error) throw error

      const attachedItems: FaqItem[] = selectedItems.map((item, idx) => {
        const attachedItem: FaqItem = {
          id: item.id,
          link_id: links[idx].id,
          product_id: productId,
          name: item.name,
          question: item.question,
          answer: item.answer,
          order_index: faqs.length + idx,
          is_active: true,
        }
        if (item.question_en != null) attachedItem.question_en = item.question_en
        if (item.answer_en != null) attachedItem.answer_en = item.answer_en
        if (item.content_i18n != null) attachedItem.content_i18n = item.content_i18n
        return attachedItem
      })

      setFaqs((prev) => [...prev, ...attachedItems])
      setShowLibraryPicker(false)
      setSelectedLibraryIds(new Set())
      setSaveMessage(
        selectedItems.length === 1
          ? '라이브러리 FAQ를 이 상품에 연결했습니다.'
          : `${selectedItems.length}개의 라이브러리 FAQ를 이 상품에 연결했습니다.`
      )
      notifyMutated()
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('FAQ attach error:', error)
      setSaveMessage('FAQ 연결에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
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

    // 데이터베이스 업데이트 (상품별 연결 순서)
    try {
      for (const faq of updatedFaqs) {
        if (!faq.link_id) continue
        await (supabase as any)
          .from('product_faq_links')
          .update({ order_index: faq.order_index })
          .eq('id', faq.link_id)
      }
      notifyMutated()
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
            ...(result.translatedFields.question != null
              ? { question_en: result.translatedFields.question }
              : {}),
            ...(result.translatedFields.answer != null
              ? { answer_en: result.translatedFields.answer }
              : {}),
          }
        } else {
          console.warn(`FAQ ${i + 1}번 번역 실패:`, result.error)
        }

        // API 제한을 고려하여 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      setFaqs(updatedFaqs)
      setSaveMessage('모든 FAQ가 번역되었습니다!')
      notifyMutated()
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
          ...(result.translatedFields.question != null
            ? { question_en: result.translatedFields.question }
            : {}),
          ...(result.translatedFields.answer != null
            ? { answer_en: result.translatedFields.answer }
            : {}),
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
      const productTitle = '투어 상품'
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

  const nestedModalClass = embedded ? 'z-[70]' : 'z-50'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <HelpCircle className="h-5 w-5 mr-2" />
          자주 묻는 질문 (FAQ)
        </h3>
        <p className="text-xs text-muted-foreground w-full md:w-auto md:mr-auto">
          FAQ는 재사용 라이브러리에 저장되며, 여러 상품에 연결할 수 있습니다.
        </p>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {saveMessage && (
            <div className={`flex items-center text-sm ${
              saveMessage.includes('성공') || saveMessage.includes('저장') || saveMessage.includes('번역') || saveMessage.includes('연결') ? 'text-green-600' : 'text-red-600'
            }`}>
              <AlertCircle className="h-4 w-4 mr-1" />
              {saveMessage}
            </div>
          )}
          <LocaleDropdown
            value={viewLocale}
            onChange={setViewLocale}
            size="sm"
            showLabel
            ariaLabel="FAQ view language"
          />
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
            onClick={() => void openLibraryPicker()}
            disabled={isNewProduct}
            className="flex items-center px-3 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            라이브러리에서 추가
          </button>
          <button
            type="button"
            onClick={handleAddFaq}
            disabled={isNewProduct}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-2" />
            새 FAQ 만들기
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
              <div className="w-full px-3 sm:px-6 py-3 sm:py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div 
                  className="flex items-start sm:items-center space-x-2 sm:space-x-3 flex-1 cursor-pointer min-w-0"
                  onClick={() => toggleFaqExpansion(faq.id!)}
                >
                  <span className="text-sm font-medium text-gray-500 flex-shrink-0">Q{index + 1}</span>
                  <h4 className="text-left font-medium text-gray-900 text-sm sm:text-base break-words">
                    {getFaqLocalizedText(faq, 'question', viewLocale)}
                  </h4>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
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
                      className="p-1 text-gray-400 hover:text-primary"
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
                <div className="px-3 sm:px-6 py-4 bg-white border-t border-gray-200">
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <span className="text-sm font-medium text-gray-500 mt-1 flex-shrink-0">A</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap break-words">
                        {getFaqLocalizedText(faq, 'answer', viewLocale)}
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
          embedded={embedded}
        />
      )}

      {showLibraryPicker && (
        <div className={`fixed inset-0 ${nestedModalClass} flex items-center justify-center bg-black/50 p-4`}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">FAQ 라이브러리에서 추가</h3>
              <button
                type="button"
                onClick={() => setShowLibraryPicker(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 border-b border-border px-4 py-3">
              <input
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void openLibraryPicker()
                }}
                placeholder="이름·질문 검색…"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void openLibraryPicker()}
                className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80"
              >
                검색
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {libraryLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  로딩 중…
                </div>
              ) : libraryItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  연결 가능한 FAQ가 없습니다. 새 FAQ를 만들거나 관리 화면에서 라이브러리를 추가하세요.
                </p>
              ) : (
                <>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={
                        libraryItems.length > 0 &&
                        selectedLibraryIds.size === libraryItems.length
                      }
                      onChange={toggleSelectAllLibrary}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                    />
                    {selectedLibraryIds.size === libraryItems.length ? '전체 해제' : '전체 선택'}
                  </label>
                  {libraryItems.map((item) => {
                    const checked = selectedLibraryIds.has(item.id)
                    return (
                      <label
                        key={item.id}
                        className={`flex w-full cursor-pointer gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          checked
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLibrarySelection(item.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-ring"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium text-foreground">
                              {item.name || item.question.slice(0, 80) || '(제목 없음)'}
                            </div>
                            <ContentLibraryLocaleBadges locales={getFaqFilledLocales(item)} />
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {getFaqLocalizedText(item, 'question', viewLocale) || item.question}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {selectedLibraryIds.size}개 선택됨
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLibraryPicker(false)
                    setSelectedLibraryIds(new Set())
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => void attachSelectedLibraryFaqs()}
                  disabled={selectedLibraryIds.size === 0}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  선택 항목 추가 ({selectedLibraryIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
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
  embedded?: boolean
}

function FaqModal({ faq, onSave, onClose, saving, embedded = false }: FaqModalProps) {
  const [formData, setFormData] = useState<FaqItem>(faq)
  const [editLocale, setEditLocale] = useState<SiteLocale>('ko')
  const [questionDraft, setQuestionDraft] = useState(() =>
    getFaqLocalizedText(faq, 'question', 'ko')
  )
  const [answerDraft, setAnswerDraft] = useState(() =>
    getFaqLocalizedText(faq, 'answer', 'ko')
  )

  const switchLocale = (next: SiteLocale) => {
    const merged = mergeFaqI18n(
      formData,
      editLocale,
      resolveFaqEditorDraftForLocale(formData, 'question', editLocale, questionDraft),
      resolveFaqEditorDraftForLocale(formData, 'answer', editLocale, answerDraft)
    )
    const nextFaq = { ...formData, ...merged }
    setFormData(nextFaq)
    setEditLocale(next)
    setQuestionDraft(getFaqLocalizedText(nextFaq, 'question', next))
    setAnswerDraft(getFaqLocalizedText(nextFaq, 'answer', next))
  }

  const handleSave = () => {
    const merged = mergeFaqI18n(
      formData,
      editLocale,
      resolveFaqEditorDraftForLocale(formData, 'question', editLocale, questionDraft),
      resolveFaqEditorDraftForLocale(formData, 'answer', editLocale, answerDraft)
    )
    const nextFaq = { ...formData, ...merged }
    const hasQ =
      !!getFaqLocalizedText(nextFaq, 'question', 'ko') ||
      !!getFaqLocalizedText(nextFaq, 'question', 'en')
    const hasA =
      !!getFaqLocalizedText(nextFaq, 'answer', 'ko') ||
      !!getFaqLocalizedText(nextFaq, 'answer', 'en')
    if (!hasQ || !hasA) {
      alert('질문과 답변을 최소 한 언어로 입력해주세요.')
      return
    }
    onSave(nextFaq)
  }

  const handleInputChange = (field: keyof FaqItem, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div
      className={`fixed inset-0 ${embedded ? 'z-[70]' : 'z-50'} flex items-center justify-center bg-black bg-opacity-50`}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6"
        onKeyDown={handleKeyDown}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-medium text-gray-900">
            {faq.id ? 'FAQ 편집' : 'FAQ 추가'}
          </h3>
          <LocaleDropdown
            value={editLocale}
            onChange={switchLocale}
            size="sm"
            showLabel
            ariaLabel="FAQ edit language"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              질문 ({getSiteLocaleMeta(editLocale).label}) *
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={questionDraft}
                onChange={(e) => setQuestionDraft(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="FAQ question"
              />
              {editLocale === 'ko' ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setQuestionDraft(await suggestFAQQuestion('투어 상품'))
                    } catch (error) {
                      console.error('ChatGPT 질문 추천 오류:', error)
                    }
                  }}
                  className="rounded-lg bg-indigo-100 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-200"
                  title="ChatGPT로 질문 추천받기"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              답변 ({getSiteLocaleMeta(editLocale).label}) *
            </label>
            <div className="flex space-x-2">
              <textarea
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                rows={6}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="FAQ answer"
              />
              {editLocale === 'ko' ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setAnswerDraft(await suggestFAQAnswer(questionDraft))
                    } catch (error) {
                      console.error('ChatGPT 답변 추천 오류:', error)
                    }
                  }}
                  className="rounded-lg bg-indigo-100 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-200"
                  title="ChatGPT로 답변 추천받기"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleInputChange('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              활성화
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
