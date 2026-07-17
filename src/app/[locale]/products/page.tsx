'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import CustomerPagePreviewHighlightEffect from '@/components/product/CustomerPagePreviewHighlightEffect'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import { getProductSummaryByLocale, formatProductDepartureLine, resolveProductListingPrice } from '@/lib/productDetailDisplay'
import { withLowestChoicePrices } from '@/lib/fetchLowestChoicePrices'
import {
  getPreviewDepartureLine,
  getPreviewListingPrice,
  getPreviewProductDisplayName,
} from '@/lib/customerPageDisplayFromBindings'
import { useCustomerPageDisplayBindings } from '@/hooks/useCustomerPageDisplayBindings'
import { fetchProductPrimaryImage } from '@/lib/fetchProductPrimaryImage'
import { useCustomerPageSoftReload } from '@/hooks/useCustomerPageSoftReload'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import ProductsListingPublicView from '@/components/products/ProductsListingPublicView'

interface Product {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string
  customer_name_en: string
  category: string
  description: string | null
  summary_ko: string | null
  summary_en: string | null
  duration: string | null
  departure_city: string | null
  base_price: number
  adult_base_price?: number | null
  max_participants: number | null
  tags: string[] | null
  primary_image?: string | null
  lowest_choice_price?: number | null
}

export default function ProductsPage() {
  const locale = useLocale()
  const searchParams = useSearchParams()
  const t = useTranslations('common')
  const { active: bindingsActive, revision: bindingRevision } = useCustomerPageDisplayBindings()
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const contentEditMode = isPreview && isEditMode

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedTag, setSelectedTag] = useState('all')
  const [priceRange, setPriceRange] = useState('all')

  useEffect(() => {
    const tagParam = searchParams.get('tag')
    if (tagParam) setSelectedTag(tagParam)
    const searchParam = searchParams.get('search')
    if (searchParam) setSearchTerm(searchParam)
    const categoryParam = searchParams.get('category')
    if (categoryParam) setSelectedCategory(categoryParam)
  }, [searchParams])

  const fetchProducts = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        if (!options?.silent) setLoading(true)
        setError(null)

        const isPreviewMode = searchParams.get('preview') === '1'
        const previewProductId = searchParams.get('productId')

        let rows: Product[] = []

        if (isPreviewMode && previewProductId) {
          const { data: previewRow, error: previewError } = await supabase
            .from('products')
            .select('*')
            .eq('id', previewProductId)
            .maybeSingle()

          if (previewError) {
            setError(t('errorLoadingProducts'))
            return
          }
          rows = previewRow ? [previewRow as Product] : []
        } else {
          const { data, error: fetchError } = await supabase
            .from('products')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })

          if (fetchError) {
            setError(t('errorLoadingProducts'))
            return
          }
          rows = (data || []) as Product[]
        }

        const productsWithImages = isPreviewMode
          ? rows.map((product) => ({ ...product, primary_image: null as string | null }))
          : await Promise.all(
              rows.map(async (product) => {
                try {
                  const primaryImage = await fetchProductPrimaryImage(product.id)
                  return { ...product, primary_image: primaryImage }
                } catch {
                  return { ...product, primary_image: null as string | null }
                }
              })
            )

        const productsWithChoicePrices = await withLowestChoicePrices(productsWithImages)
        setProducts(productsWithChoicePrices)
      } catch {
        setError(t('errorLoadingProducts'))
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [searchParams, t]
  )

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  useCustomerPageSoftReload(() => fetchProducts({ silent: true }))

  const getCategoryLabel = useCallback(
    (category: string) => {
      const categoryLabels: Record<string, string> = {
      city: t('city'),
      nature: t('nature'),
      culture: t('culture'),
      adventure: t('adventure'),
      food: t('food'),
      tour: t('tour'),
      sightseeing: t('sightseeing'),
        outdoor: t('outdoor'),
    }
    return categoryLabels[category] || category
    },
    [t]
  )

  const getCustomerDisplayName = useCallback(
    (product: Product) => {
    void bindingRevision
    if (bindingsActive) {
        return getPreviewProductDisplayName(
          'listing-card-name',
          product as unknown as Record<string, unknown>,
          locale
        )
      }
      if (locale === 'en' && product.customer_name_en) return product.customer_name_en
    return product.customer_name_ko || product.name_ko || product.name
    },
    [bindingsActive, bindingRevision, locale]
  )

  const getListDepartureLine = useCallback(
    (product: Product) => {
    void bindingRevision
    if (bindingsActive) {
        return getPreviewDepartureLine(
          'listing-card-location',
          product as unknown as Record<string, unknown>,
          locale
        )
    }
    return formatProductDepartureLine(product, locale)
    },
    [bindingsActive, bindingRevision, locale]
  )

  const getListPrice = useCallback(
    (product: Product) => {
    void bindingRevision
    if (bindingsActive) {
        return (
          getPreviewListingPrice(
            'listing-card-price',
            product as unknown as Record<string, unknown>,
            resolveProductListingPrice(product as unknown as Record<string, unknown>)
          ) ??
          resolveProductListingPrice(product as unknown as Record<string, unknown>) ??
          product.base_price ??
          0
        )
    }
    return resolveProductListingPrice(product as unknown as Record<string, unknown>) ?? product.base_price ?? 0
    },
    [bindingsActive, bindingRevision]
  )

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const productName = getCustomerDisplayName(product)
      const productDescription = getProductSummaryByLocale(product, locale)
      const productTags = product.tags || []

      const matchesSearch =
        productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        productDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        productTags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory

      const matchesTag =
        selectedTag === 'all' ||
        productTags.some((tag) => tag.toLowerCase().includes(selectedTag.toLowerCase()))

      let matchesPrice = true
      if (priceRange === 'low') matchesPrice = product.base_price <= 150
      else if (priceRange === 'medium')
        matchesPrice = product.base_price > 150 && product.base_price <= 300
      else if (priceRange === 'high') matchesPrice = product.base_price > 300

      return matchesSearch && matchesCategory && matchesTag && matchesPrice
    })
  }, [
    products,
    searchTerm,
    selectedCategory,
    selectedTag,
    priceRange,
    locale,
    getCustomerDisplayName,
  ])

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    searchTerm !== '' ||
    selectedTag !== 'all' ||
    priceRange !== 'all'

  const showListingGrid = hasActiveFilters

  const listingGroups = useMemo(() => {
    const sourceProducts = showListingGrid ? filteredProducts : products
    const grouped: Record<string, Product[]> = {}

    sourceProducts.forEach((product) => {
      const category = product.category || 'other'
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(product)
    })

    return Object.keys(grouped)
      .sort((a, b) => {
        if (a === 'Tour' || a === 'tour') return -1
        if (b === 'Tour' || b === 'tour') return 1
        return a.localeCompare(b)
      })
      .map((category) => ({
        id: category,
        title: t('listingGroupTitle', { category: getCategoryLabel(category) }),
        products: grouped[category] ?? [],
      }))
      .filter((group) => group.products.length > 0)
  }, [showListingGrid, filteredProducts, products, getCategoryLabel, t])

  const filterPills = useMemo(() => {
    const uniqueCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)))
    return [
      {
        id: 'all',
        label: t('all'),
        active: !hasActiveFilters,
        onClick: () => {
          setSelectedCategory('all')
          setSelectedTag('all')
          setSearchTerm('')
          setPriceRange('all')
        },
      },
      ...uniqueCategories.map((category) => ({
        id: category,
        label: getCategoryLabel(category),
        active: selectedCategory === category,
        onClick: () => {
          setSelectedCategory((prev) => (prev === category ? 'all' : category))
        },
      })),
    ]
  }, [products, hasActiveFilters, selectedCategory, getCategoryLabel, t])

  const clearListingFilters = useCallback(() => {
    setSelectedCategory('all')
    setSelectedTag('all')
    setSearchTerm('')
    setPriceRange('all')
  }, [])

  const handleListingImageError = useCallback((productId: string) => {
    setImageErrors((prev) => new Set(prev).add(productId))
  }, [])

  return (
    <CustomerPageShell locale={locale}>
      <div className={contentEditMode ? 'min-h-screen bg-muted/30' : ''}>
        <CustomerPagePreviewHighlightEffect />
        <ProductsListingPublicView
          locale={locale}
          t={t}
          loading={loading}
          error={error}
          searchTerm={searchTerm}
          selectedTag={selectedTag}
          selectedCategory={selectedCategory}
          priceRange={priceRange}
          onRetry={() => void fetchProducts()}
          onClearFilters={clearListingFilters}
          filterPills={filterPills}
          groups={listingGroups}
          gridProducts={filteredProducts}
          showGrid={showListingGrid}
          resultCount={filteredProducts.length}
          getProductTitle={(product) => getCustomerDisplayName(product as Product)}
          getProductLocation={(product) => getListDepartureLine(product as Product)}
          getProductPrice={(product) => getListPrice(product as Product)}
          imageErrors={imageErrors}
          onImageError={handleListingImageError}
          editableZones={contentEditMode}
        />
      </div>
    </CustomerPageShell>
  )
}
