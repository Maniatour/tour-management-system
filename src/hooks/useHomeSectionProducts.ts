'use client'

import { useEffect, useState } from 'react'
import type { HomePageSectionEntry } from '@/lib/customerPageHomeSectionCatalog'
import {
  fetchHomeSectionProductsForSection,
  type HomeSectionProductRow,
} from '@/lib/customerPageHomeSectionProducts'
import { fetchProductPrimaryImage } from '@/lib/fetchProductPrimaryImage'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'

export function useHomeSectionProducts(section: HomePageSectionEntry | null) {
  const [products, setProducts] = useState<HomeSectionProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { revision } = useCustomerPageFieldBindings()

  useEffect(() => {
    if (!section || section.kind !== 'card-list') {
      setProducts([])
      setLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchHomeSectionProductsForSection(section.instanceId, section.config)
        const withImages = await Promise.all(
          rows.map(async (row) => ({
            ...row,
            primary_image: await fetchProductPrimaryImage(row.id),
          }))
        )
        if (!cancelled) setProducts(withImages)
      } catch (err) {
        console.error('Failed to load section products:', err)
        if (!cancelled) {
          setError('상품을 불러오지 못했습니다.')
          setProducts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [section?.instanceId, section?.kind, JSON.stringify(section?.config), revision])

  return { products, loading, error }
}
