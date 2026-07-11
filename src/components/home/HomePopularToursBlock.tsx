'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import TourCard from '@/components/customer/ui/TourCard'
import TourGrid from '@/components/customer/ui/TourGrid'
import { Badge } from '@/components/ui/badge'
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

function mapGridLayout(variant: PopularStructureVariant) {
  switch (variant) {
    case 'grid-two-large':
      return 'grid-two' as const
    case 'featured-plus-grid':
      return 'featured-grid' as const
    case 'stacked-list':
      return 'list' as const
    case 'horizontal-scroll':
      return 'scroll' as const
    default:
      return 'grid' as const
  }
}

function mapCardVariant(
  variant: PopularStructureVariant,
  index: number
): 'grid' | 'stacked' | 'horizontal' | 'featured' {
  if (variant === 'stacked-list') return 'stacked'
  if (variant === 'horizontal-scroll') return 'horizontal'
  if (variant === 'featured-plus-grid' && index === 0) return 'featured'
  if (variant === 'grid-two-large') return 'featured'
  return 'grid'
}

function imageHeightClass(variant: PopularStructureVariant, index: number): string {
  if (variant === 'stacked-list') return 'relative h-44 sm:h-auto sm:w-52 md:w-64 shrink-0 bg-muted'
  if (variant === 'grid-two-large') return 'relative h-52 sm:h-64 bg-muted'
  if (variant === 'featured-plus-grid' && index === 0) return 'relative h-52 sm:h-72 bg-muted'
  if (variant === 'horizontal-scroll') return 'relative h-44 bg-muted'
  return 'relative h-40 sm:h-48 bg-muted aspect-[4/3]'
}

function cardShellClass(variant: PopularStructureVariant, index: number): string {
  const base =
    'cp-ui-card-surface rounded-card shadow-card border overflow-hidden hover:shadow-card-hover transition-all duration-300 relative'
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

  const renderPublicCard = (product: PopularProductView, index: number) => (
    <TourCard
      key={product.id}
      href={`/${locale}/products/${product.id}`}
      variant={mapCardVariant(variant, index)}
      ctaLabel={t('viewDetails')}
      image={
        <div className={imageHeightClass(variant, index)}>
          <Image
            src={product.primary_image ?? '/placeholder-tour.svg'}
            alt={getProductName(product)}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {product.category && variant !== 'stacked-list' ? (
            <div className="absolute left-2 top-2">
              <Badge variant="neutral">{product.category}</Badge>
            </div>
          ) : null}
        </div>
      }
    >
      <h3 className="text-card-title mb-2 text-foreground">{getProductName(product)}</h3>
      {variant !== 'stacked-list' ? (
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
          {getProductDescription(product)}
        </p>
      ) : null}
      {getCardDepartureLine(product) ? (
        <div className="mb-3 flex items-center text-sm text-muted-foreground">
          <MapPin className="mr-2 h-4 w-4 shrink-0 cp-ui-icon" aria-hidden />
          <span className="truncate">{getCardDepartureLine(product)}</span>
        </div>
      ) : null}
      <span className="text-base font-bold cp-ui-price">{getPriceLabel(getCardPrice(product))}</span>
    </TourCard>
  )

  const renderAdminCard = (product: PopularProductView, index: number) => {
    const isFavorite = product.favorite_order !== null && product.favorite_order !== undefined
    const canMoveUp = isAdmin && isFavorite && index > 0
    const canMoveDown = isAdmin && isFavorite && index < popularTours.length - 1
    const bodyPadding =
      variant === 'stacked-list' ? 'p-4 sm:p-5 flex-1 flex flex-col justify-center' : 'p-4 sm:p-6'

    const cardContent = (
      <>
        {isAdmin && isFavorite && (
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 rounded-md bg-white/90 p-1 shadow-md">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChangeFavoriteOrder(product.id, 'up')
              }}
              disabled={!canMoveUp || isChangingOrder}
              className="rounded p-1 hover:bg-muted disabled:opacity-50"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChangeFavoriteOrder(product.id, 'down')
              }}
              disabled={!canMoveDown || isChangingOrder}
              className="rounded p-1 hover:bg-muted disabled:opacity-50"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        )}

        <CardZone zone="listing-card-image" productId={product.id}>
          <div className={imageHeightClass(variant, index)}>
            <img
              src={product.primary_image ?? '/placeholder-tour.svg'}
              alt={getProductName(product)}
              className="h-full w-full object-cover"
            />
          </div>
        </CardZone>

        <div className={bodyPadding}>
          <CardZone zone="listing-card-name" productId={product.id}>
            <h3 className="mb-2 text-base font-semibold text-foreground sm:text-lg">
              <Link href={`/${locale}/products/${product.id}`}>{getProductName(product)}</Link>
            </h3>
          </CardZone>

          {variant !== 'stacked-list' && (
            <CardZone zone="listing-card-description" productId={product.id}>
              <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                {getProductDescription(product)}
              </p>
            </CardZone>
          )}

          {getCardDepartureLine(product) && (
            <CardZone zone="listing-card-location" productId={product.id} className="mb-3 text-sm text-muted-foreground">
              <div className="flex items-center">
                <MapPin className="mr-2 h-4 w-4 shrink-0 cp-ui-icon" />
                <span className="truncate">{getCardDepartureLine(product)}</span>
              </div>
            </CardZone>
          )}

          <CardZone zone="listing-card-price" productId={product.id}>
            <div className="mb-3 text-base font-bold cp-ui-price">
              {getPriceLabel(getCardPrice(product))}
            </div>
          </CardZone>

          <Link
            href={`/${locale}/products/${product.id}`}
            className="cp-ui-btn-primary block w-full rounded-btn py-2.5 text-center text-sm font-semibold"
          >
            {t('viewDetails')}
          </Link>
        </div>
      </>
    )

    return (
      <CardZone
        key={product.id}
        zone="listing-card"
        productId={product.id}
        suppressEditButton
        className={cardShellClass(variant, index)}
      >
        {cardContent}
      </CardZone>
    )
  }

  return (
    <TourGrid layout={mapGridLayout(variant)}>
      {popularLoading && (
        <div className="col-span-full flex justify-center py-10 text-muted-foreground">{t('loading')}</div>
      )}
      {!popularLoading && popularError && (
        <div className="col-span-full py-10 text-center text-muted-foreground">{popularError}</div>
      )}
      {!popularLoading && !popularError && popularTours.length === 0 && (
        <div className="col-span-full py-10 text-center text-muted-foreground">
          {locale === 'en' ? 'No popular tours are available yet.' : '등록된 인기 투어가 없습니다.'}
        </div>
      )}
      {!popularLoading &&
        !popularError &&
        popularTours.map((product, index) =>
          showCardEditZones ? renderAdminCard(product, index) : renderPublicCard(product, index)
        )}
    </TourGrid>
  )
}
