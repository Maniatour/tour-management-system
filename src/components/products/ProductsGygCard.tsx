'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Clock, Heart, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { formatProductDurationShort } from '@/lib/productDetailDisplay'

export type ProductsGygCardProduct = {
  id: string
  primary_image?: string | null
  duration: string | null
  max_participants: number | null
  departure_city: string | null
}

type ProductsGygCardProps = {
  locale: string
  href: string
  product: ProductsGygCardProduct
  title: string
  locationLine: string | null
  price: number
  priceLabel: string
  imageError: boolean
  onImageError: () => void
  likelyToSellOutLabel?: string
  imagePreparingLabel: string
  priority?: boolean
  /** 고객 페이지 편집 — 카드 내부 zone 수정 버튼 */
  editableZones?: boolean
}

function CardZone({
  zone,
  productId,
  className = '',
  suppressEditButton,
  children,
}: {
  zone: string
  productId: string
  className?: string
  suppressEditButton?: boolean
  children: ReactNode
}) {
  return (
    <CustomerPageZone
      zone={zone}
      productId={productId}
      className={className}
      {...(suppressEditButton ? { suppressEditButton } : {})}
    >
      {children}
    </CustomerPageZone>
  )
}

export default function ProductsGygCard({
  locale,
  href,
  product,
  title,
  locationLine,
  price,
  priceLabel,
  imageError,
  onImageError,
  likelyToSellOutLabel,
  imagePreparingLabel,
  priority = false,
  editableZones = false,
}: ProductsGygCardProps) {
  const showSelloutBadge =
    product.max_participants != null && product.max_participants <= 20 && likelyToSellOutLabel

  const durationLabel = formatProductDurationShort(product.duration, locale === 'en')
  const metaParts = [durationLabel, locationLine].filter(Boolean)

  const imageBlock = (
    <div className="gyg-listing-card-image">
      {product.primary_image && !imageError ? (
        <Image
          src={product.primary_image}
          alt={title}
          fill
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 33vw, 280px"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          priority={priority}
          onError={onImageError}
          unoptimized={process.env.NODE_ENV === 'development'}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#f3f4f6] text-sm text-[#6b7280]">
          {imagePreparingLabel}
        </div>
      )}

      {showSelloutBadge ? (
        <span className="gyg-sellout-badge">{likelyToSellOutLabel}</span>
      ) : null}

      <span
        className="gyg-wishlist-btn"
        onClick={(e) => e.preventDefault()}
        aria-hidden
      >
        <Heart className="h-4 w-4 text-[#1a2b49]" strokeWidth={1.75} />
      </span>
    </div>
  )

  const titleBlock = <h3 className="gyg-listing-card-title line-clamp-2">{title}</h3>

  const priceBlock = (
    <p className="gyg-listing-card-price ml-auto">
      {priceLabel}{' '}
      <span className="font-bold text-[#ff5533]">
        {new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(price)}
      </span>
    </p>
  )

  const cardInner = (
    <>
      {editableZones ? (
        <CardZone zone="listing-card-image" productId={product.id} suppressEditButton>
          {imageBlock}
        </CardZone>
      ) : (
        imageBlock
      )}

      <div className="gyg-listing-card-body">
        {locationLine ? (
          editableZones ? (
            <CardZone zone="listing-card-location" productId={product.id} suppressEditButton>
              <p className="gyg-listing-card-location">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {locationLine}
              </p>
            </CardZone>
          ) : (
            <p className="gyg-listing-card-location">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {locationLine}
            </p>
          )
        ) : null}

        {editableZones ? (
          <CardZone zone="listing-card-name" productId={product.id} suppressEditButton>
            {titleBlock}
          </CardZone>
        ) : (
          titleBlock
        )}

        {metaParts.length > 0 ? (
          <p className="gyg-listing-card-meta">
            {metaParts.map((part, index) => (
              <span key={`${part}-${index}`}>
                {index > 0 ? ' • ' : null}
                {part === durationLabel ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {part}
                  </span>
                ) : (
                  part
                )}
              </span>
            ))}
          </p>
        ) : null}

        <div className="gyg-listing-card-footer mt-auto">
          {editableZones ? (
            <CardZone zone="listing-card-price" productId={product.id}>
              {priceBlock}
            </CardZone>
          ) : (
            priceBlock
          )}
        </div>
      </div>
    </>
  )

  const cardLink = (
    <Link href={href} className="gyg-listing-card group block" role="listitem">
      {cardInner}
    </Link>
  )

  if (editableZones) {
    return (
      <CardZone zone="listing-card" productId={product.id} suppressEditButton className="relative">
        {cardLink}
      </CardZone>
    )
  }

  return cardLink
}
