'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProductDetailsTab from '@/components/product/ProductDetailsTab'

type DetailsFormData = Parameters<typeof ProductDetailsTab>[0]['formData']

const EMPTY_DETAILS_FORM: DetailsFormData = {
  useCommonDetails: false,
  currentLanguage: 'ko',
  productDetails: {
    ko: {
      slogan1: '',
      slogan2: '',
      slogan3: '',
      greeting: '',
      description: '',
      included: '',
      not_included: '',
      pickup_drop_info: '',
      luggage_info: '',
      tour_operation_info: '',
      preparation_info: '',
      small_group_info: '',
      companion_recruitment_info: '',
      notice_info: '',
      important_notes: '',
      private_tour_info: '',
      cancellation_policy: '',
      chat_announcement: '',
      tags: [],
    },
  },
  useCommonForField: {
    ko: {
      slogan1: false,
      slogan2: false,
      slogan3: false,
      greeting: false,
      description: false,
      included: false,
      not_included: false,
      pickup_drop_info: false,
      luggage_info: false,
      tour_operation_info: false,
      preparation_info: false,
      small_group_info: false,
      companion_recruitment_info: false,
      notice_info: false,
      important_notes: false,
      private_tour_info: false,
      cancellation_policy: false,
      chat_announcement: false,
      tags: false,
    },
  },
}

function mapDetailsRow(item: Record<string, unknown>) {
  const lang = String(item.language_code ?? 'ko')
  return {
    lang,
    fields: {
      slogan1: String(item.slogan1 ?? ''),
      slogan2: String(item.slogan2 ?? ''),
      slogan3: String(item.slogan3 ?? ''),
      greeting: String(item.greeting ?? ''),
      description: String(item.description ?? ''),
      included: String(item.included ?? ''),
      not_included: String(item.not_included ?? ''),
      pickup_drop_info: String(item.pickup_drop_info ?? ''),
      luggage_info: String(item.luggage_info ?? ''),
      tour_operation_info: String(item.tour_operation_info ?? ''),
      preparation_info: String(item.preparation_info ?? ''),
      small_group_info: String(item.small_group_info ?? ''),
      companion_recruitment_info: String(item.companion_recruitment_info ?? ''),
      notice_info: String(item.notice_info ?? ''),
      important_notes: String(item.important_notes ?? ''),
      private_tour_info: String(item.private_tour_info ?? ''),
      cancellation_policy: String(item.cancellation_policy ?? ''),
      chat_announcement: String(item.chat_announcement ?? ''),
      tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
    },
  }
}

type CustomerPageProductDetailsEmbedProps = {
  productId: string
  onSaved?: () => void
}

export default function CustomerPageProductDetailsEmbed({
  productId,
  onSaved,
}: CustomerPageProductDetailsEmbedProps) {
  const [formData, setFormData] = useState<DetailsFormData>(EMPTY_DETAILS_FORM)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)

        if (fetchError) throw fetchError
        if (cancelled) return

        const multilingual: DetailsFormData['productDetails'] = { ...EMPTY_DETAILS_FORM.productDetails }
        const useCommonForField: DetailsFormData['useCommonForField'] = {
          ...EMPTY_DETAILS_FORM.useCommonForField,
        }

        if (Array.isArray(data)) {
          for (const row of data) {
            const mapped = mapDetailsRow(row as Record<string, unknown>)
            multilingual[mapped.lang] = mapped.fields
            if (!useCommonForField[mapped.lang]) {
              useCommonForField[mapped.lang] = { ...EMPTY_DETAILS_FORM.useCommonForField.ko }
            }
          }
        }

        setFormData({
          useCommonDetails: false,
          currentLanguage: 'ko',
          productDetails: multilingual,
          useCommonForField,
        })
      } catch (err) {
        if (!cancelled) setError(String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [productId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        상세정보 불러오는 중…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-600">불러오기 실패: {error}</p>
  }

  return (
    <ProductDetailsTab
      productId={productId}
      isNewProduct={false}
      formData={formData}
      setFormData={setFormData}
      {...(onSaved ? { onSaveSuccess: onSaved } : {})}
    />
  )
}
