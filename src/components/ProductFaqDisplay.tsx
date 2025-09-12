'use client'

import React, { useState, useEffect } from 'react'
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FaqItem {
  id: string
  product_id: string
  question: string
  answer: string
  order_index: number
  is_active: boolean
}

interface ProductFaqDisplayProps {
  productId: string
}

export default function ProductFaqDisplay({ productId }: ProductFaqDisplayProps) {
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchFaqs()
  }, [productId])

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
      setFaqs([])
    } finally {
      setLoading(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">FAQ를 불러오는 중...</span>
      </div>
    )
  }

  if (faqs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <HelpCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>등록된 FAQ가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">자주 묻는 질문</h3>
      
      <div className="space-y-2">
        {faqs.map((faq, index) => (
          <div key={faq.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFaqExpansion(faq.id)}
              className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-blue-600">Q{index + 1}</span>
                <h4 className="text-left font-medium text-gray-900">
                  {faq.question}
                </h4>
              </div>
              {expandedFaqs.has(faq.id) ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            
            {expandedFaqs.has(faq.id) && (
              <div className="px-6 py-4 bg-white border-t border-gray-200">
                <div className="flex items-start space-x-3">
                  <span className="text-sm font-medium text-green-600 mt-1">A</span>
                  <div className="flex-1">
                    <p className="text-gray-700 whitespace-pre-wrap">{faq.answer}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
