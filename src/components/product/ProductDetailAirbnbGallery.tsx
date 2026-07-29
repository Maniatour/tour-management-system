'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Grid2x2, Heart, Mountain, Share2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ProductMedia, TourCoursePhoto } from '@/components/product/productDetailTypes'
import { buildProductGalleryImages } from '@/lib/productDetailGalleryImages'
import { useCustomerPageLayoutMode } from '@/hooks/useCustomerPageLayoutMode'

type ProductDetailAirbnbGalleryProps = {
  productMedia: ProductMedia[]
  tourCoursePhotos: TourCoursePhoto[]
  displayName: string
  isEnglish: boolean
}

export default function ProductDetailAirbnbGallery({
  productMedia,
  tourCoursePhotos,
  displayName,
  isEnglish,
}: ProductDetailAirbnbGalleryProps) {
  const t = useTranslations('productDetail')
  const { isMdDownLayout } = useCustomerPageLayoutMode()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mounted, setMounted] = useState(false)

  const images = buildProductGalleryImages(productMedia, tourCoursePhotos)
  const gridImages = images.slice(0, 5)

  const openLightbox = (index = 0) => {
    setActiveIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
  }, [])

  const goToPrev = useCallback(() => {
    setActiveIndex((index) => (index - 1 + images.length) % images.length)
  }, [images.length])

  const goToNext = useCallback(() => {
    setActiveIndex((index) => (index + 1) % images.length)
  }, [images.length])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!lightboxOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeLightbox()
        return
      }

      if (images.length <= 1) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPrev()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [closeLightbox, goToNext, goToPrev, images.length, lightboxOpen])

  if (images.length === 0) {
    return (
      <div className="airbnb-detail-gallery-empty">
        <Mountain className="mx-auto mb-3 h-10 w-10 text-[#9ca3af]" aria-hidden />
        <p className="font-semibold text-[#1a2b49]">{displayName}</p>
        <p className="mt-1 text-sm text-[#6b7280]">
          {isEnglish ? 'Photos coming soon' : '사진 준비 중'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="airbnb-detail-gallery">
        {isMdDownLayout ? (
        <div className="airbnb-detail-gallery-mobile">
          <button type="button" className="airbnb-detail-gallery-main" onClick={() => openLightbox(0)}>
            <Image
              src={images[0].file_url}
              alt={images[0].alt_text || displayName}
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
          </button>
          {images.length > 1 ? (
            <button
              type="button"
              className="airbnb-detail-show-photos-btn"
              onClick={() => openLightbox(0)}
            >
              <Grid2x2 className="h-4 w-4" aria-hidden />
              {t('showAllPhotos')}
            </button>
          ) : null}
        </div>
        ) : null}

        {!isMdDownLayout ? (
        <div className="airbnb-detail-gallery-desktop grid">
          <button
            type="button"
            className="airbnb-detail-gallery-hero"
            onClick={() => openLightbox(0)}
          >
            <Image
              src={gridImages[0].file_url}
              alt={gridImages[0].alt_text || displayName}
              fill
              sizes="50vw"
              priority
              className="object-cover transition-transform duration-300 hover:scale-[1.02]"
            />
          </button>

          {gridImages.slice(1).map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={`airbnb-detail-gallery-thumb airbnb-detail-gallery-thumb-${index + 1}`}
              onClick={() => openLightbox(index + 1)}
            >
              <Image
                src={image.file_url}
                alt={image.alt_text || image.file_name}
                fill
                sizes="25vw"
                className="object-cover transition-transform duration-300 hover:scale-[1.02]"
              />
            </button>
          ))}

          {images.length > 1 ? (
            <button
              type="button"
              className="airbnb-detail-show-photos-btn airbnb-detail-show-photos-btn-desktop"
              onClick={() => openLightbox(0)}
            >
              <Grid2x2 className="h-4 w-4" aria-hidden />
              {t('showAllPhotos')}
            </button>
          ) : null}
        </div>
        ) : null}
      </div>

      {lightboxOpen && mounted
        ? createPortal(
            <div
              className="airbnb-detail-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={isEnglish ? 'Photo gallery' : '사진 갤러리'}
            >
              <button
                type="button"
                className="airbnb-detail-lightbox-close"
                onClick={closeLightbox}
                aria-label={isEnglish ? 'Close' : '닫기'}
              >
                <X className="h-5 w-5" />
              </button>
              <div className="airbnb-detail-lightbox-actions">
                <button type="button" aria-label={t('share')} className="airbnb-detail-action-btn">
                  <Share2 className="h-4 w-4" />
                </button>
                <button type="button" aria-label={t('save')} className="airbnb-detail-action-btn">
                  <Heart className="h-4 w-4" />
                </button>
              </div>

              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="airbnb-detail-lightbox-nav airbnb-detail-lightbox-nav--prev"
                    onClick={goToPrev}
                    aria-label={isEnglish ? 'Previous photo' : '이전 사진'}
                  >
                    <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="airbnb-detail-lightbox-nav airbnb-detail-lightbox-nav--next"
                    onClick={goToNext}
                    aria-label={isEnglish ? 'Next photo' : '다음 사진'}
                  >
                    <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
                  </button>
                  <p className="airbnb-detail-lightbox-counter" aria-live="polite">
                    {activeIndex + 1} / {images.length}
                  </p>
                </>
              ) : null}

              <div className="airbnb-detail-lightbox-main">
                <Image
                  key={images[activeIndex].id}
                  src={images[activeIndex].file_url}
                  alt={images[activeIndex].alt_text || displayName}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  priority
                />
              </div>

              {images.length > 1 ? (
                <div className="airbnb-detail-lightbox-thumbs">
                  {images.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      className={`airbnb-detail-lightbox-thumb ${activeIndex === index ? 'is-active' : ''}`}
                      onClick={() => setActiveIndex(index)}
                      aria-label={
                        isEnglish
                          ? `View photo ${index + 1} of ${images.length}`
                          : `사진 ${index + 1} / ${images.length} 보기`
                      }
                      aria-current={activeIndex === index ? 'true' : undefined}
                    >
                      <Image
                        src={image.file_url}
                        alt={image.alt_text || image.file_name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
