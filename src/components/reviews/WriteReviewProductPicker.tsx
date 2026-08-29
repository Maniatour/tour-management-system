'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Loader2, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { withPrimaryImages } from '@/lib/fetchProductPrimaryImagesBatch'
import { fetchProductFieldTranslations, getProductLocalizedField } from '@/lib/productFieldTranslations'
import { readPublicOperatorIdBrowser } from '@/lib/operators/readPublicOperatorIdBrowser'
import { normalizeSiteLocale } from '@/lib/siteLocales'

export type WriteReviewProductOption = {
  id: string
  title: string
  imageUrl: string | null
}

type WriteReviewProductPickerProps = {
  open: boolean
  locale: string
  searchPlaceholder: string
  emptyLabel: string
  closeLabel: string
  onClose: () => void
  onSelect: (product: WriteReviewProductOption) => void
}

export default function WriteReviewProductPicker({
  open,
  locale,
  searchPlaceholder,
  emptyLabel,
  closeLabel,
  onClose,
  onSelect,
}: WriteReviewProductPickerProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<WriteReviewProductOption[]>([])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const siteLocale = normalizeSiteLocale(locale)

    void (async () => {
      setLoading(true)
      try {
        const operatorId = readPublicOperatorIdBrowser()
        const { data, error } = await supabase
          .from('products')
          .select('id, name, name_ko, name_en, customer_name_ko, customer_name_en')
          .eq('operator_id', operatorId)
          .eq('status', 'active')
          .eq('is_published', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[write-review] product list failed', error)
          if (!cancelled) setOptions([])
          return
        }

        const rows = (data ?? []) as Array<{
          id: string
          name: string | null
          name_ko: string | null
          name_en: string | null
          customer_name_ko: string | null
          customer_name_en: string | null
        }>
        const withImages = await withPrimaryImages(rows)
        const translations = await fetchProductFieldTranslations(rows.map((row) => row.id))

        if (cancelled) return

        setOptions(
          withImages.map((row) => {
            const title =
              getProductLocalizedField(row, 'customer_name', siteLocale, translations) ||
              getProductLocalizedField(row, 'name', siteLocale, translations) ||
              row.name?.trim() ||
              row.id
            return { id: row.id, title, imageUrl: row.primary_image }
          })
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, locale])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter((item) => item.title.toLowerCase().includes(term))
  }, [options, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={searchPlaceholder}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-muted"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/70"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" fill className="object-cover" sizes="48px" />
                      ) : null}
                    </div>
                    <span className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
