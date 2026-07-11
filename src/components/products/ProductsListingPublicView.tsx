'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight, Info, Loader2, Search } from 'lucide-react'
import HomeSearchBar from '@/components/home/HomeSearchBar'
import ProductsGygCard, { type ProductsGygCardProduct } from '@/components/products/ProductsGygCard'
import ProductsHorizontalScroll from '@/components/products/ProductsHorizontalScroll'

type ProductGroup = {
  id: string
  title: string
  products: ProductsGygCardProduct[]
}

type ProductsListingPublicViewProps = {
  locale: string
  t: (key: string, values?: Record<string, string | number>) => string
  loading: boolean
  error: string | null
  searchTerm: string
  selectedTag: string
  selectedCategory: string
  priceRange: string
  onRetry: () => void
  onClearFilters: () => void
  filterPills: Array<{ id: string; label: string; active: boolean; onClick: () => void }>
  groups: ProductGroup[]
  gridProducts: ProductsGygCardProduct[]
  showGrid: boolean
  resultCount: number
  getProductTitle: (product: ProductsGygCardProduct) => string
  getProductLocation: (product: ProductsGygCardProduct) => string | null
  getProductPrice: (product: ProductsGygCardProduct) => number
  imageErrors: Set<string>
  onImageError: (productId: string) => void
}

export default function ProductsListingPublicView({
  locale,
  t,
  loading,
  error,
  searchTerm,
  selectedTag,
  selectedCategory,
  priceRange,
  onRetry,
  onClearFilters,
  filterPills,
  groups,
  gridProducts,
  showGrid,
  resultCount,
  getProductTitle,
  getProductLocation,
  getProductPrice,
  imageErrors,
  onImageError,
}: ProductsListingPublicViewProps) {
  const participantOptions =
    locale === 'en'
      ? ['1 participant', '2 participants', '3 participants', '4 participants', '5+ participants']
      : ['1명', '2명', '3명', '4명', '5명 이상']

  const renderCard = (product: ProductsGygCardProduct, index: number) => (
    <ProductsGygCard
      key={product.id}
      locale={locale}
      href={`/${locale}/products/${product.id}`}
      product={product}
      title={getProductTitle(product)}
      locationLine={getProductLocation(product)}
      price={getProductPrice(product)}
      priceLabel={t('listingFromPrice')}
      imageError={imageErrors.has(product.id)}
      onImageError={() => onImageError(product.id)}
      likelyToSellOutLabel={t('likelyToSellOut')}
      imagePreparingLabel={t('imagePreparing')}
      priority={index < 4}
    />
  )

  const mobileFeedProducts = useMemo(() => {
    const source = showGrid ? gridProducts : groups.flatMap((group) => group.products)
    const seen = new Set<string>()
    return source.filter((product) => {
      if (seen.has(product.id)) return false
      seen.add(product.id)
      return true
    })
  }, [showGrid, gridProducts, groups])

  return (
    <div className="gyg-listing min-h-screen bg-white pb-12">
      <section className="border-b border-[#e5e7eb] bg-white">
        <div className="gyg-container py-5 md:py-6">
          <HomeSearchBar
            locale={locale}
            initialQuery={searchTerm}
            searchPlaceholder={t('homeSearchPlaceholder')}
            anytimeLabel={t('homeSearchAnytime')}
            participantLabel={t('homeSearchParticipants')}
            participantOptions={participantOptions}
            searchButtonLabel={t('search')}
          />
        </div>
      </section>

      <div className="gyg-container py-6 md:py-8">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[#6b7280]" aria-label="Breadcrumb">
          <Link href={`/${locale}`} className="hover:text-[#1a2b49]">
            {t('home')}
          </Link>
          <ChevronRight className="h-4 w-4" aria-hidden />
          <span className="text-[#1a2b49]">{t('navThingsToDo')}</span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-[#1a2b49] md:text-3xl">
          {t('listingPageTitle')}
        </h1>

        <div className="gyg-listing-pills mt-5">
          {filterPills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={pill.onClick}
              className={`gyg-listing-pill ${pill.active ? 'gyg-listing-pill-active' : ''}`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-sm text-[#6b7280]">
          {t('listingResultsCount', { count: resultCount })}
          <Info className="h-4 w-4" aria-hidden />
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#6b7280]">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            {t('loadingProducts')}
          </div>
        ) : null}

        {error ? (
          <div className="py-16 text-center">
            <p className="mb-4 text-red-600">{error}</p>
            <button type="button" onClick={onRetry} className="gyg-search-submit px-6 py-2">
              {t('tryAgain')}
            </button>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="gyg-listing-mobile-feed mt-6 md:hidden">
            {mobileFeedProducts.length > 0 ? (
              mobileFeedProducts.map((product, index) => renderCard(product, index))
            ) : (
              <div className="gyg-listing-empty">
                <Search className="mx-auto mb-3 h-10 w-10 text-[#d1d5db]" aria-hidden />
                <p className="text-lg font-semibold text-[#1a2b49]">{t('noSearchResults')}</p>
                <p className="text-sm text-[#6b7280]">{t('tryDifferentSearch')}</p>
              </div>
            )}
          </div>
        ) : null}

        {!loading && !error && showGrid ? (
          <div className="gyg-listing-grid mt-6 hidden md:grid">
            {gridProducts.length > 0 ? (
              gridProducts.map((product, index) => renderCard(product, index))
            ) : (
              <div className="gyg-listing-empty col-span-full">
                <Search className="mx-auto mb-3 h-10 w-10 text-[#d1d5db]" aria-hidden />
                <p className="text-lg font-semibold text-[#1a2b49]">{t('noSearchResults')}</p>
                <p className="text-sm text-[#6b7280]">{t('tryDifferentSearch')}</p>
              </div>
            )}
          </div>
        ) : null}

        {!loading && !error && !showGrid ? (
          <div className="mt-8 hidden space-y-10 md:block md:space-y-12">
            {groups.length > 0 ? (
              groups.map((group) => (
                <section key={group.id} aria-labelledby={`group-${group.id}`}>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 id={`group-${group.id}`} className="text-xl font-bold text-[#1a2b49] md:text-2xl">
                      {group.title}
                    </h2>
                    <Link
                      href={`/${locale}/products?category=${encodeURIComponent(group.id)}`}
                      className="hidden text-sm font-semibold text-[#0071eb] hover:underline sm:inline"
                    >
                      {t('viewAllTours')}
                    </Link>
                  </div>
                  <ProductsHorizontalScroll ariaLabel={group.title}>
                    {group.products.map((product, index) => (
                      <div key={product.id} className="gyg-listing-scroll-item">
                        {renderCard(product, index)}
                      </div>
                    ))}
                  </ProductsHorizontalScroll>
                </section>
              ))
            ) : (
              <div className="gyg-listing-empty">
                <Search className="mx-auto mb-3 h-10 w-10 text-[#d1d5db]" aria-hidden />
                <p className="text-lg font-semibold text-[#1a2b49]">{t('noSearchResults')}</p>
                <p className="text-sm text-[#6b7280]">{t('tryDifferentSearch')}</p>
              </div>
            )}
          </div>
        ) : null}

        {(selectedTag !== 'all' || selectedCategory !== 'all' || searchTerm || priceRange !== 'all') && (
          <div className="mt-8">
            <button
              type="button"
              onClick={onClearFilters}
              className="text-sm font-semibold text-[#0071eb] hover:underline"
            >
              {t('listingClearFilters')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
