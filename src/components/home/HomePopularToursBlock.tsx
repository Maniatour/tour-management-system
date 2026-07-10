'use client'

import Link from 'next/link'
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import type { PopularStructureVariant } from '@/lib/customerPageHomeStructure'

export type PopularProductView = {
  id: string
  category: string | null
  primary_image: string | null
  favorite_order: number | null
  duration: string | null
  max_participants: number | null
  [key: string]: unknown
}

export type PopularToursBlockProps = {
  variant: PopularStructureVariant
  locale: string
  t: (key: string) => string
  popularTours: PopularProductView[]
  popularLoading: boolean
  popularError: string | null
  isAdmin: boolean
  isChangingOrder: boolean
  showCardEditZones: boolean
  getProductName: (product: PopularProductView) => string
  getProductDescription: (product: PopularProductView) => string
  getCardDepartureLine: (product: PopularProductView) => string | null
  getCardPrice: (product: PopularProductView) => number | null
  getPriceLabel: (price: number | null) => string
  onChangeFavoriteOrder: (productId: string, direction: 'up' | 'down') => void | Promise<void>
}

function gridClassForVariant(variant: PopularStructureVariant): string {
  switch (variant) {
    case 'grid-two-large':
      return 'grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8'
    case 'featured-plus-grid':
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-fr'
    case 'stacked-list':
      return 'flex flex-col gap-4 sm:gap-5'
    case 'horizontal-scroll':
      return 'cp-home-scroll-row flex gap-4 sm:gap-6 pb-2'
    default:
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8'
  }
}

function cardShellClass(variant: PopularStructureVariant, index: number): string {
  const base =
    'cp-ui-card-surface rounded-xl shadow-sm border overflow-hidden hover:shadow-lg transition-all duration-300 relative'
  if (variant === 'stacked-list') {
    return `${base} flex flex-col sm:flex-row sm:items-stretch`
  }
  if (variant === 'horizontal-scroll') {
    return `${base} min-w-[min(88vw,320px)] sm:min-w-[340px] shrink-0 snap-start`
  }
  if (variant === 'featured-plus-grid' && index === 0) {
    return `${base} sm:col-span-2 lg:row-span-2`
  }
  if (variant === 'grid-two-large') {
    return `${base} hover:-translate-y-0.5`
  }
  return base
}

function imageHeightClass(variant: PopularStructureVariant, index: number): string {
  if (variant === 'stacked-list') return 'relative h-44 sm:h-auto sm:w-52 md:w-64 shrink-0 bg-gray-200'
  if (variant === 'grid-two-large') return 'relative h-52 sm:h-64 bg-gray-200'
  if (variant === 'featured-plus-grid' && index === 0) return 'relative h-52 sm:h-72 bg-gray-200'
  if (variant === 'horizontal-scroll') return 'relative h-44 bg-gray-200'
  return 'relative h-40 sm:h-48 bg-gray-200'
}

export default function HomePopularToursBlock(props: PopularToursBlockProps) {
  const {
    variant,
    locale,
    t,
    popularTours,
    popularLoading,
    popularError,
    isAdmin,
    isChangingOrder,
    showCardEditZones,
    getProductName,
    getProductDescription,
    getCardDepartureLine,
    getCardPrice,
    getPriceLabel,
    onChangeFavoriteOrder,
  } = props

  const CardZone = ({
    zone,
    className = '',
    productId,
    suppressEditButton,
    children,
  }: {
    zone: string
    className?: string
    productId: string
    suppressEditButton?: boolean
    children: ReactNode
  }) =>
    showCardEditZones ? (
      <CustomerPageZone
        zone={zone}
        productId={productId}
        className={className}
        {...(suppressEditButton ? { suppressEditButton } : {})}
      >
        {children}
      </CustomerPageZone>
    ) : (
      <div className={className}>{children}</div>
    )

  const renderCard = (product: PopularProductView, index: number) => {
    const isFavorite = product.favorite_order !== null && product.favorite_order !== undefined
    const canMoveUp = isAdmin && isFavorite && index > 0
    const canMoveDown = isAdmin && isFavorite && index < popularTours.length - 1
    const bodyPadding =
      variant === 'stacked-list' ? 'p-4 sm:p-5 flex-1 flex flex-col justify-center' : 'p-4 sm:p-6'

    const cardContent = (
      <>
        {isAdmin && isFavorite && (
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 bg-white/90 rounded-md p-1 shadow-md">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChangeFavoriteOrder(product.id, 'up')
              }}
              disabled={!canMoveUp || isChangingOrder}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <ChevronUp size={16} className="text-gray-600" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChangeFavoriteOrder(product.id, 'down')
              }}
              disabled={!canMoveDown || isChangingOrder}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <ChevronDown size={16} className="text-gray-600" />
            </button>
          </div>
        )}

        <CardZone zone="listing-card-image" productId={product.id}>
          <div className={imageHeightClass(variant, index)}>
            <img
              src={product.primary_image ?? '/placeholder-tour.svg'}
              alt={getProductName(product)}
              className="w-full h-full object-cover"
            />
            {product.category && variant !== 'stacked-list' && (
              <div className="absolute top-2 left-2">
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {product.category}
                </span>
              </div>
            )}
          </div>
        </CardZone>

        <div className={bodyPadding}>
          <CardZone zone="listing-card-name" productId={product.id}>
            <h3 className="font-semibold text-gray-900 mb-2 text-base sm:text-lg">
              <Link href={`/${locale}/products/${product.id}`} className="hover:text-blue-600">
                {getProductName(product)}
              </Link>
            </h3>
          </CardZone>

          {variant !== 'stacked-list' && (
            <CardZone zone="listing-card-description" productId={product.id}>
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{getProductDescription(product)}</p>
            </CardZone>
          )}

          {getCardDepartureLine(product) && (
            <CardZone zone="listing-card-location" productId={product.id} className="mb-3 text-sm text-gray-600">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-blue-600 shrink-0" />
                <span className="truncate">{getCardDepartureLine(product)}</span>
              </div>
            </CardZone>
          )}

          <CardZone zone="listing-card-price" productId={product.id}>
            <div className="mb-3">
              <span className="text-base font-bold cp-ui-price">
                {getPriceLabel(getCardPrice(product))}
              </span>
            </div>
          </CardZone>

          <Link
            href={`/${locale}/products/${product.id}`}
            className="cp-ui-btn-primary w-full py-2.5 px-4 rounded-xl text-center block text-sm font-semibold"
          >
            {t('viewDetails')}
          </Link>
        </div>
      </>
    )

    const shellClass = cardShellClass(variant, index)
    return showCardEditZones ? (
      <CardZone key={product.id} zone="listing-card" productId={product.id} suppressEditButton className={shellClass}>
        {cardContent}
      </CardZone>
    ) : (
      <div key={product.id} className={shellClass}>
        {cardContent}
      </div>
    )
  }

  return (
    <div className={gridClassForVariant(variant)}>
      {popularLoading && (
        <div className="col-span-full flex justify-center py-10 text-gray-500">{t('loading')}</div>
      )}
      {!popularLoading && popularError && (
        <div className="col-span-full py-10 text-center text-gray-500">{popularError}</div>
      )}
      {!popularLoading && !popularError && popularTours.length === 0 && (
        <div className="col-span-full py-10 text-center text-gray-500">
          {locale === 'en' ? 'No popular tours are available yet.' : '등록된 인기 투어가 없습니다.'}
        </div>
      )}
      {!popularLoading && !popularError && popularTours.map(renderCard)}
    </div>
  )
}
