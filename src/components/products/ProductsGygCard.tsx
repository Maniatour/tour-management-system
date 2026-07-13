'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Clock, Heart, ImageIcon, MapPin, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { formatProductDurationShort } from '@/lib/productDetailDisplay'
import {
  getProductListingRibbonLabelKey,
  getProductListingRibbonVariantClass,
  resolveProductListingRibbon,
} from '@/lib/productListingRibbon'

export type ProductsGygCardProduct = {
  id: string
  primary_image?: string | null
  duration: string | null
  max_participants: number | null
  departure_city: string | null
  tags?: string[] | null
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
  /** 위시리스트 버튼 표시 (관리자 카드 등에서는 false) */
  showWishlistButton?: boolean
  /** 이미지 우상단 오버레이 (관리자 액션 등) */
  imageOverlay?: ReactNode
  /** 관리자 — 매진 임박 뱃지 슬롯 (클릭 토글 등) */
  selloutBadgeSlot?: ReactNode
  /** 관리자 카드뷰 — 영역별 수정 모달 트리거 */
  adminCardEdits?: {
    editLocationLabel: string
    editTitleLabel: string
    editDurationLabel: string
    editPriceLabel: string
    editMediaLabel: string
    onEditLocation: () => void
    onEditBasic: () => void
    onEditTourDetails: () => void
    onEditPricing: () => void
    onEditMedia: () => void
  }
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
  likelyToSellOutLabel: _likelyToSellOutLabel,
  imagePreparingLabel,
  priority = false,
  editableZones = false,
  showWishlistButton = true,
  imageOverlay,
  selloutBadgeSlot,
  adminCardEdits,
}: ProductsGygCardProps) {
  const tCommon = useTranslations('common')
  const listingRibbon = resolveProductListingRibbon(product)

  const durationLabel = formatProductDurationShort(product.duration, locale === 'en')
  const metaParts = [durationLabel, locationLine].filter(Boolean)

  const imageBlock = (
    <div className="gyg-listing-card-image">
      {adminCardEdits ? (
        <button
          type="button"
          className="gyg-listing-card-image-edit-trigger"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            adminCardEdits.onEditMedia()
          }}
          title={adminCardEdits.editMediaLabel}
          aria-label={adminCardEdits.editMediaLabel}
        >
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
          <span className="gyg-listing-card-image-edit-hint" aria-hidden>
            <ImageIcon className="h-4 w-4" />
            {adminCardEdits.editMediaLabel}
          </span>
        </button>
      ) : product.primary_image && !imageError ? (
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

      {selloutBadgeSlot ? (
        selloutBadgeSlot
      ) : listingRibbon ? (
        <span className={getProductListingRibbonVariantClass(listingRibbon.variant)}>
          {tCommon(getProductListingRibbonLabelKey(listingRibbon.id))}
        </span>
      ) : null}

      {imageOverlay ? (
        imageOverlay
      ) : showWishlistButton ? (
        <span
          className="gyg-wishlist-btn"
          onClick={(e) => e.preventDefault()}
          aria-hidden
        >
          <Heart className="h-4 w-4 text-[#1a2b49]" strokeWidth={1.75} />
        </span>
      ) : null}
    </div>
  )

  const titleBlock = adminCardEdits ? (
    <button
      type="button"
      className="gyg-listing-card-title gyg-listing-card-editable line-clamp-2 text-left"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        adminCardEdits.onEditBasic()
      }}
      title={adminCardEdits.editTitleLabel}
      aria-label={adminCardEdits.editTitleLabel}
    >
      {title}
    </button>
  ) : (
    <h3 className="gyg-listing-card-title line-clamp-2">{title}</h3>
  )

  const formattedPrice = `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price)}+`

  const priceBlock = adminCardEdits ? (
    <button
      type="button"
      className="gyg-listing-card-price gyg-listing-card-editable ml-auto text-right"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        adminCardEdits.onEditPricing()
      }}
      title={adminCardEdits.editPriceLabel}
      aria-label={adminCardEdits.editPriceLabel}
    >
      {priceLabel.trim() ? `${priceLabel} ` : null}
      <span className="font-bold text-[#ff5533]">{formattedPrice}</span>
    </button>
  ) : (
    <p className="gyg-listing-card-price ml-auto">
      {priceLabel.trim() ? `${priceLabel} ` : null}
      <span className="font-bold text-[#ff5533]">{formattedPrice}</span>
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
          ) : adminCardEdits ? (
            <div className="gyg-listing-card-location gyg-listing-card-location-row">
              <p className="gyg-listing-card-location gyg-listing-card-location-text">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {locationLine}
              </p>
              <button
                type="button"
                className="gyg-listing-card-edit-btn"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  adminCardEdits.onEditLocation()
                }}
                title={adminCardEdits.editLocationLabel}
                aria-label={adminCardEdits.editLocationLabel}
              >
                <Pencil className="h-3 w-3" aria-hidden />
              </button>
            </div>
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
                  adminCardEdits ? (
                    <button
                      type="button"
                      className="gyg-listing-card-editable inline-flex items-center gap-1"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        adminCardEdits.onEditTourDetails()
                      }}
                      title={adminCardEdits.editDurationLabel}
                      aria-label={adminCardEdits.editDurationLabel}
                    >
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {part}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {part}
                    </span>
                  )
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

  if (adminCardEdits) {
    return (
      <div className="gyg-listing-card group block" role="listitem">
        {cardInner}
      </div>
    )
  }

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
