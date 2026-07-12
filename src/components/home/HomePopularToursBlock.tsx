'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Heart, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import HomeGygCarousel from '@/components/home/HomeGygCarousel'
import HomeManiaTourCarousel from '@/components/home/HomeManiaTourCarousel'
import type { PopularStructureVariant } from '@/lib/customerPageHomeStructure'
import { formatProductDurationShort } from '@/lib/productDetailDisplay'

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
    getCardPrice,
    getPriceLabel,
    onChangeFavoriteOrder,
  } = props

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

  const renderManiaTourCard = (product: PopularProductView, index: number) => {
    const badgeConfigs = [
      { labelKey: 'maniatourBadgeBest', variant: 'best' },
      { labelKey: 'maniatourBadgeBestSeller', variant: 'best-seller' },
      { labelKey: 'maniatourBadgePopular', variant: 'popular' },
    ] as const
    const badge = badgeConfigs[index]
    const demoMeta = [
      { rating: '4.9', reviewCount: 1234, duration: '17 hrs' },
      { rating: '4.9', reviewCount: 987, duration: '11 hrs' },
      { rating: '4.8', reviewCount: 756, duration: '10 hrs' },
      { rating: '4.8', reviewCount: 512, duration: '6 hrs' },
      { rating: '4.7', reviewCount: 423, duration: '11 hrs' },
      { rating: '4.8', reviewCount: 635, duration: '14 hrs' },
    ]
    const cardMeta = demoMeta[index] ?? demoMeta[demoMeta.length - 1]!
    const duration =
      formatProductDurationShort(product.duration, locale === 'en') ?? cardMeta.duration
    const price = getCardPrice(product)
    const hasPrice = price != null && price > 0
    const priceAmount = hasPrice ? `$${Math.round(price)}+` : getPriceLabel(price)

    return (
      <Link
        key={product.id}
        href={`/${locale}/products/${product.id}`}
        className={`kv-tour-card group${showCardEditZones ? ' relative' : ''}`}
        role="listitem"
      >
        {renderFavoriteOrderControls(product, index)}
        <article className="kv-tour-card-inner">
          <CardZone zone="listing-card-image" productId={product.id} suppressEditButton>
            <div className="kv-tour-card-image">
              <Image
                src={product.primary_image ?? '/placeholder-tour.svg'}
                alt={getProductName(product)}
                fill
                sizes="(max-width: 640px) 72vw, 196px"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              {badge ? (
                <span className={`kv-tour-badge kv-tour-badge--${badge.variant}`}>{t(badge.labelKey)}</span>
              ) : null}
            </div>
          </CardZone>
          <div className="kv-tour-card-body">
            <CardZone zone="listing-card-name" productId={product.id} suppressEditButton>
              <h3 className="kv-tour-card-title line-clamp-2">{getProductName(product)}</h3>
            </CardZone>
            <div className="kv-tour-card-rating-row">
              <Star className="kv-tour-card-star" aria-hidden />
              <span className="kv-tour-card-rating">{cardMeta.rating}</span>
              <span className="kv-tour-card-reviews">({cardMeta.reviewCount.toLocaleString()})</span>
            </div>
            <p className="kv-tour-card-details">
              {t('maniatourSmallGroupLabel')} · {duration}
            </p>
            <CardZone zone="listing-card-price" productId={product.id}>
              <p className="kv-tour-card-price">
                <span className="kv-tour-card-price-amount">{priceAmount}</span>
                {hasPrice ? (
                  <span className="kv-tour-card-price-unit">{t('maniatourPerPerson')}</span>
                ) : null}
              </p>
            </CardZone>
          </div>
        </article>
      </Link>
    )
  }

  const renderGygCard = (product: PopularProductView, index: number) => {
    if (variant === 'maniatour-carousel') {
      return renderManiaTourCard(product, index)
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

    const showSelloutBadge =
      product.max_participants != null && product.max_participants <= 20

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
            {showSelloutBadge ? (
              <span className="gyg-sellout-badge">{t('likelyToSellOut')}</span>
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
    return <HomeManiaTourCarousel ariaLabel="Popular tours">{cards}</HomeManiaTourCarousel>
  }

  return (
    <HomeGygCarousel
      ariaLabel={variant === 'attraction-cards' ? 'Attractions' : 'Activities'}
    >
      {cards}
    </HomeGygCarousel>
  )
}
