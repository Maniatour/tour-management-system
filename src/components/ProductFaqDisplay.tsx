'use client'

import { useState, useEffect, useCallback } from 'react'
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { getFaqLocalizedText, type FaqContentI18n } from '@/lib/productFaqLocales'

interface FaqItem {
  id: string
  product_id: string
  question: string
  answer: string
  question_en?: string | null
  answer_en?: string | null
  content_i18n?: FaqContentI18n | null
  order_index: number
  is_active: boolean
}

interface ProductFaqDisplayProps {
  productId: string
}

export default function ProductFaqDisplay({ productId }: ProductFaqDisplayProps) {
  const t = useTranslations('productDetail')
  const locale = useLocale()
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
        (data || []).map((row) => {
          const r = row as Record<string, unknown>
          return {
            id: String(r.id),
            product_id: String(r.product_id),
            question: String(r.question ?? ''),
            answer: String(r.answer ?? ''),
            question_en: (r.question_en as string | null) ?? null,
            answer_en: (r.answer_en as string | null) ?? null,
            content_i18n: (r.content_i18n as FaqContentI18n | null) ?? null,
            order_index: Number(r.order_index ?? 0),
            is_active: r.is_active !== false,
          }
        })
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
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-600">{t('faqLoading')}</span>
      </div>
    )
  }

  if (faqs.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        <HelpCircle className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <p>{t('noFaqRegistered')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="space-y-2 sm:space-y-3">
        {faqs.map((faq, index) => {
          const question = getFaqLocalizedText(faq, 'question', locale)
          const answer = getFaqLocalizedText(faq, 'answer', locale)
          if (!question && !answer) return null
          return (
            <div
              key={faq.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:rounded-2xl sm:shadow-sm sm:transition-shadow sm:hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => toggleFaqExpansion(faq.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5 sm:py-4"
              >
                <span className="text-sm font-semibold text-slate-900 sm:text-base">
                  <span className="mr-2 text-slate-400">Q{index + 1}</span>
                  {question}
                </span>
                {expandedFaqs.has(faq.id) ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
                )}
              </button>
              {expandedFaqs.has(faq.id) ? (
                <div className="border-t border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 sm:text-base">
                    {answer}
                  </p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
