'use client'

import { useState, useEffect, useCallback } from 'react'
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('productDetail')
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set())

  const fetchFaqs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('product_faqs')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('order_index', { ascending: true })

      if (error) {
        console.error('Supabase 오류:', error)
        throw new Error(`데이터베이스 오류: ${error.message}`)
      }

      setFaqs(
        (data || []).map((row) => ({
          id: row.id,
          product_id: row.product_id,
          question: row.question,
          answer: row.answer,
          order_index: row.order_index ?? 0,
          is_active: row.is_active ?? true,
        }))
      )
    } catch (error) {
      console.error('FAQ 로드 오류:', error)
      setFaqs([])
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchFaqs()
  }, [fetchFaqs])

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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-600">{t('faqLoading')}</span>
      </div>
    )
  }

  if (faqs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <HelpCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>{t('noFaqRegistered')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="space-y-2 sm:space-y-3">
        {faqs.map((faq, index) => (
          <div
            key={faq.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:rounded-2xl sm:shadow-sm sm:transition-shadow sm:hover:shadow-md"
          >
            <button
              type="button"
              onClick={() => toggleFaqExpansion(faq.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 sm:gap-4 sm:px-6 sm:py-5"
              aria-expanded={expandedFaqs.has(faq.id)}
            >
              <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                <span className="mt-0.5 shrink-0 rounded-md bg-booking/10 px-1.5 py-0.5 text-[10px] font-bold text-booking sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs">
                  Q{index + 1}
                </span>
                <h4 className="text-sm font-semibold text-slate-900 sm:text-base">{faq.question}</h4>
              </div>
              {expandedFaqs.has(faq.id) ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-slate-400 sm:h-5 sm:w-5" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 sm:h-5 sm:w-5" aria-hidden />
              )}
            </button>

            {expandedFaqs.has(faq.id) && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-3 sm:px-6 sm:py-5">
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="mt-0.5 shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs">
                    A
                  </span>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 sm:text-sm">{faq.answer}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
