'use client'

import React, { useState, useEffect } from 'react'
import { HelpCircle, Plus, Edit, Trash2, Save, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FaqItem {
  id?: string
  product_id: string
  question: string
  answer: string
  order_index: number
  is_active: boolean
}

interface ProductFaqTabProps {
  productId: string
  isNewProduct: boolean
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
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

  // 기존 FAQ 데이터 로드
  useEffect(() => {
    if (!isNewProduct && productId) {
      fetchFaqs()
    } else {
      setLoading(false)
    }
  }, [productId, isNewProduct])

  const fetchFaqs = async () => {
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
  }

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
              saveMessage.includes('성공') || saveMessage.includes('저장') ? 'text-green-600' : 'text-red-600'
            }`}>
              <AlertCircle className="h-4 w-4 mr-1" />
              {saveMessage}
            </div>
          )}
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
                    {faq.question}
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
                      <p className="text-gray-700 whitespace-pre-wrap">{faq.answer}</p>
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

  const handleSave = () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      alert('질문과 답변을 모두 입력해주세요.')
      return
    }
    onSave(formData)
  }

  const handleInputChange = (field: keyof FaqItem, value: any) => {
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {faq.id ? 'FAQ 편집' : 'FAQ 추가'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              질문 *
            </label>
            <input
              type="text"
              value={formData.question}
              onChange={(e) => handleInputChange('question', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="자주 묻는 질문을 입력해주세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              답변 *
            </label>
            <textarea
              value={formData.answer}
              onChange={(e) => handleInputChange('answer', e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="질문에 대한 답변을 입력해주세요"
              required
            />
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
