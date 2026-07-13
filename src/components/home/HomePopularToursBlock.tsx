'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Heart } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import HomeGygCarousel from '@/components/home/HomeGygCarousel'
import ProductsGygCard from '@/components/products/ProductsGygCard'
import ProductsHorizontalScroll from '@/components/products/ProductsHorizontalScroll'
import type { PopularStructureVariant } from '@/lib/customerPageHomeStructure'
import { formatProductDurationShort } from '@/lib/productDetailDisplay'
import {
  getProductListingRibbonLabelKey,
  getProductListingRibbonVariantClass,
  resolveProductListingRibbon,
} from '@/lib/productListingRibbon'

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
    getCardDepartureLine,
    getCardPrice,
    getPriceLabel,
    onChangeFavoriteOrder,
  } = props

  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const CardZone = ({
    zone,
    productId,
    suppressEditButton,
    children,
  }: {
    zone: string
    productId: string
    suppressEditButton?: boolean
    children: ReactNode
  }) =>
    showCardEditZones ? (
      <CustomerPageZone
        zone={zone}
        productId={productId}
        {...(suppressEditButton ? { suppressEditButton } : {})}
      >
        {children}
      </CustomerPageZone>
    ) : (
      <>{children}</>
    )

  const renderFavoriteOrderControls = (product: PopularProductView, index: number) => {
    const isFavorite = product.favorite_order !== null && product.favorite_order !== undefined
    if (!showCardEditZones || !isAdmin || !isFavorite) return null

    return (
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 rounded-md bg-white/90 p-1 shadow-md">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onChangeFavoriteOrder(product.id, 'up')
          }}
          disabled={index <= 0 || isChangingOrder}
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
          disabled={index >= popularTours.length - 1 || isChangingOrder}
          className="rounded p-1 hover:bg-muted disabled:opacity-50"
        >
          <ChevronDown size={16} />
        </button>
      </div>
    )
  }

  const renderListingCard = (product: PopularProductView, index: number) => (
    <div key={product.id} className="gyg-listing-scroll-item relative">
      {renderFavoriteOrderControls(product, index)}
      <ProductsGygCard
        locale={locale}
        href={`/${locale}/products/${product.id}`}
        product={{
          id: product.id,
          primary_image: product.primary_image,
          duration: product.duration,
          max_participants: product.max_participants,
          departure_city:
            typeof product.departure_city === 'string' ? product.departure_city : null,
          tags: Array.isArray(product.tags) ? product.tags : null,
        }}
        title={getProductName(product)}
        locationLine={getCardDepartureLine(product)}
        price={getCardPrice(product) ?? 0}
        priceLabel={t('listingFromPrice')}
        imageError={imageErrors.has(product.id)}
        onImageError={() =>
          setImageErrors((prev) => {
            const next = new Set(prev)
            next.add(product.id)
            return next
          })
        }
        likelyToSellOutLabel={t('likelyToSellOut')}
        imagePreparingLabel={t('imagePreparing')}
        priority={index < 4}
        editableZones={showCardEditZones}
      />
    </div>
  )

  const renderGygCard = (product: PopularProductView, index: number) => {
    if (variant === 'maniatour-carousel') {
      return renderListingCard(product, index)
    }

    if (variant === 'attraction-cards') {
      const metaText =
        formatProductDurationShort(product.duration, locale === 'en') ??
        getPriceLabel(getCardPrice(product))

      return (
        <Link
          key={product.id}
          href={`/${locale}/products/${product.id}`}
          className={`gyg-attraction-card${showCardEditZones ? ' relative' : ''}`}
          role="listitem"
        >
          {renderFavoriteOrderControls(product, index)}
          <CardZone zone="listing-card-image" productId={product.id} suppressEditButton>
            <div className="gyg-card-image">
              <Image
                src={product.primary_image ?? '/placeholder-tour.svg'}
                alt={getProductName(product)}
                fill
                sizes="260px"
                className="object-cover"
              />
            </div>
          </CardZone>
          <CardZone zone="listing-card-name" productId={product.id} suppressEditButton>
            <h3 className="gyg-card-title line-clamp-2">{getProductName(product)}</h3>
          </CardZone>
          <CardZone zone="listing-card-price" productId={product.id}>
            <p className="gyg-card-meta">{metaText}</p>
          </CardZone>
        </Link>
      )
    }

    const listingRibbon = resolveProductListingRibbon({
      max_participants: product.max_participants,
      tags: Array.isArray(product.tags) ? product.tags : null,
    })

    return (
      <Link
        key={product.id}
        href={`/${locale}/products/${product.id}`}
        className={`gyg-activity-card group${showCardEditZones ? ' relative' : ''}`}
        role="listitem"
      >
        {renderFavoriteOrderControls(product, index)}
        <CardZone zone="listing-card-image" productId={product.id} suppressEditButton>
          <div className="gyg-card-image">
            <Image
              src={product.primary_image ?? '/placeholder-tour.svg'}
              alt={getProductName(product)}
              fill
              sizes="280px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            {listingRibbon ? (
              <span className={getProductListingRibbonVariantClass(listingRibbon.variant)}>
                {t(getProductListingRibbonLabelKey(listingRibbon.id))}
              </span>
            ) : null}
            <span
              className="gyg-wishlist-btn"
              onClick={(e) => e.preventDefault()}
              aria-hidden
            >
              <Heart className="h-4 w-4 text-[#1a2b49]" strokeWidth={1.75} />
            </span>
          </div>
        </CardZone>
        <CardZone zone="listing-card-name" productId={product.id} suppressEditButton>
          <h3 className="gyg-card-title line-clamp-2">{getProductName(product)}</h3>
        </CardZone>
        <CardZone zone="listing-card-price" productId={product.id}>
          <p className="gyg-card-meta">{getPriceLabel(getCardPrice(product))}</p>
        </CardZone>
      </Link>
    )
  }

  const cards = popularLoading ? (
    <div className="py-10 text-center text-[#6b7280]">{t('loading')}</div>
  ) : popularError ? (
    <div className="py-10 text-center text-[#6b7280]">{popularError}</div>
  ) : popularTours.length === 0 ? (
    <div className="py-10 text-center text-[#6b7280]">
      {locale === 'en' ? 'No popular tours are available yet.' : '등록된 인기 투어가 없습니다.'}
    </div>
  ) : (
    popularTours.map((product, index) => renderGygCard(product, index))
  )

  if (variant === 'maniatour-carousel') {
    return <ProductsHorizontalScroll ariaLabel="Popular tours">{cards}</ProductsHorizontalScroll>
  }

  return (
    <HomeGygCarousel
      ariaLabel={variant === 'attraction-cards' ? 'Attractions' : 'Activities'}
    >
      {cards}
    </HomeGygCarousel>
  )
}
