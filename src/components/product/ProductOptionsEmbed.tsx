'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import OptionsTab from '@/components/product/OptionsTab'
import { supabase } from '@/lib/supabase'

type ProductOption = {
  id: string
  name: string
  description: string
  isRequired: boolean
  isMultiple: boolean
  choices: unknown[]
  linkedOptionId?: string
  adultPrice?: number
  childPrice?: number
  infantPrice?: number
  imageUrl?: string
  imageAlt?: string
}

type ProductOptionsEmbedProps = {
  productId: string
  onOpenFullAdmin?: (tabId: string) => void
}

export default function ProductOptionsEmbed({
  productId,
  onOpenFullAdmin,
}: ProductOptionsEmbedProps) {
  const [options, setOptions] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)

  const loadOptions = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('product_options')
        .select('*')
        .eq('product_id', productId)
        .order('name', { ascending: true })

      if (error) throw error

      const grouped = new Map<string, ProductOption>()
      for (const row of data ?? []) {
        const key = String(row.name || row.id)
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: String(row.id),
            name: String(row.name || ''),
            description: String(row.description || ''),
            isRequired: Boolean(row.is_required),
            isMultiple: Boolean(row.is_multiple),
            choices: [],
            ...(row.linked_option_id ? { linkedOptionId: String(row.linked_option_id) } : {}),
            adultPrice: Number(row.adult_price_adjustment || 0),
            childPrice: Number(row.child_price_adjustment || 0),
            infantPrice: Number(row.infant_price_adjustment || 0),
            ...(row.image_url ? { imageUrl: String(row.image_url) } : {}),
            ...(row.image_alt ? { imageAlt: String(row.image_alt) } : {}),
          })
        }
      }
      setOptions(Array.from(grouped.values()))
    } catch (error) {
      console.error('옵션 로드 오류:', error)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        옵션을 불러오는 중…
      </div>
    )
  }

  return (
    <OptionsTab
      formData={{ productOptions: options }}
      setShowAddOptionModal={() => onOpenFullAdmin?.('options')}
      removeProductOption={(optionId) =>
        setOptions((current) => current.filter((option) => option.id !== optionId))
      }
      updateProductOption={(optionId, updates) =>
        setOptions((current) =>
          current.map((option) =>
            option.id === optionId ? { ...option, ...updates } as ProductOption : option
          )
        )
      }
      productId={productId}
      isNewProduct={false}
    />
  )
}
