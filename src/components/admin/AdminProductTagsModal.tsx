'use client'

import { useEffect, useState } from 'react'
import { Loader2, Tags, X } from 'lucide-react'
import ProductTagsBilingualEditor, {
  loadTagTranslations,
  saveProductTagsWithTranslations,
  type TagTranslationState,
} from '@/components/product/ProductTagsBilingualEditor'
import { supabase } from '@/lib/supabase'

type Props = {
  isOpen: boolean
  onClose: () => void
  productId: string
  productLabel?: string
  locale?: string
  initialTags?: string[] | null
  onSaved?: (productId: string, tags: string[]) => void
}

export default function AdminProductTagsModal({
  isOpen,
  onClose,
  productId,
  productLabel,
  locale = 'ko',
  initialTags = null,
  onSaved,
}: Props) {
  const isEn = locale === 'en'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tagKeys, setTagKeys] = useState<string[]>([])
  const [tagTranslations, setTagTranslations] = useState<TagTranslationState>({})
  const [displayName, setDisplayName] = useState(productLabel ?? productId)

  useEffect(() => {
    if (!isOpen || !productId) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        if (initialTags != null) {
          setTagKeys([...initialTags])
          setTagTranslations(await loadTagTranslations(initialTags))
          setDisplayName(productLabel ?? productId)
        } else {
          const { data, error: fetchError } = await supabase
            .from('products')
            .select('id, name, name_ko, customer_name_ko, customer_name_en, tags')
            .eq('id', productId)
            .maybeSingle()

          if (fetchError) throw fetchError
          if (!data) throw new Error(isEn ? 'Product not found' : '상품을 찾을 수 없습니다.')

          const tags = Array.isArray(data.tags) ? (data.tags as string[]) : []
          setTagKeys(tags)
          setTagTranslations(await loadTagTranslations(tags))
          setDisplayName(
            productLabel ||
              (locale === 'en'
                ? data.customer_name_en || data.name || data.name_ko || productId
                : data.customer_name_ko || data.name_ko || data.name || productId)
          )
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isOpen, productId, initialTags, productLabel, locale, isEn])

  if (!isOpen) return null

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveProductTagsWithTranslations(productId, tagKeys, tagTranslations)
      onSaved?.(productId, tagKeys)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="flex max-h-[90vh] min-h-[min(72vh,640px)] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">
                {isEn ? 'Manage tags' : '태그 관리'}
              </h2>
            </div>
            <p className="mt-1 truncate text-xs text-gray-500 sm:text-sm">{displayName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {isEn ? 'Loading…' : '불러오는 중…'}
            </div>
          ) : (
            <ProductTagsBilingualEditor
              selectedTags={tagKeys}
              onTagsChange={setTagKeys}
              onTranslationsChange={setTagTranslations}
              locale={locale}
            />
          )}

          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            {isEn ? 'Cancel' : '취소'}
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEn ? 'Save' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
