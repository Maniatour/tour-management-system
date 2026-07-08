'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Heart, Share2 } from 'lucide-react'
import type { ProductMedia, TourCoursePhoto } from '@/components/product/productDetailTypes'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { cn } from '@/lib/utils'

const AUTO_SLIDE_INTERVAL_MS = 4000
const MANUAL_SELECT_PAUSE_MS = 3000

type GalleryImage = {
  id: string
  file_url: string
  alt_text: string
  file_name: string
}

type ProductDetailImageGalleryProps = {
  productMedia: ProductMedia[]
  tourCoursePhotos: TourCoursePhoto[]
  displayName: string
  isEnglish: boolean
}

function buildGalleryImages(
  productMedia: ProductMedia[],
  tourCoursePhotos: TourCoursePhoto[]
): GalleryImage[] {
  const mediaImages = productMedia.filter((item) => item.file_type === 'image')
  const tourCourseImages = tourCoursePhotos.map((photo) => ({
    id: `tour-course-${photo.id}`,
    file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photo.photo_url}`,
    alt_text: photo.photo_alt_ko || photo.photo_alt_en || 'Tour course photo',
    file_name: photo.photo_url,
  }))
  return [...mediaImages, ...tourCourseImages]
}

export default function ProductDetailImageGallery({
  productMedia,
  tourCoursePhotos,
  displayName,
  isEnglish,
}: ProductDetailImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isAutoSlidePaused, setIsAutoSlidePaused] = useState(false)

  const allImages = buildGalleryImages(productMedia, tourCoursePhotos)

  useEffect(() => {
    setSelectedImageIndex(0)
  }, [productMedia, tourCoursePhotos])

  useEffect(() => {
    if (allImages.length <= 1 || isAutoSlidePaused) {
      return
    }

    const interval = setInterval(() => {
      setSelectedImageIndex((prevIndex) => (prevIndex + 1) % allImages.length)
    }, AUTO_SLIDE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [allImages.length, isAutoSlidePaused])

  const handleThumbnailSelect = (index: number) => {
    setSelectedImageIndex(index)
    setIsAutoSlidePaused(true)
    setTimeout(() => setIsAutoSlidePaused(false), MANUAL_SELECT_PAUSE_MS)
  }

  return (
    <CustomerPageZone zone="detail-gallery" className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-hidden rounded-2xl">
      {allImages.length > 0 ? (
        <>
          <div
            className="relative h-[50vh] min-h-[280px] w-full bg-slate-100 sm:h-[55vh] md:h-[60vh] lg:h-[560px]"
            onMouseEnter={() => setIsAutoSlidePaused(true)}
            onMouseLeave={() => setIsAutoSlidePaused(false)}
          >
            <Image
              src={allImages[selectedImageIndex].file_url}
              alt={allImages[selectedImageIndex].alt_text || allImages[selectedImageIndex].file_name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px"
              priority
              className="object-cover transition-opacity duration-500"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
            <div className="absolute right-4 top-4 z-10 flex gap-2">
              <button
                type="button"
                aria-label={isEnglish ? 'Save to favorites' : '즐겨찾기'}
                className="rounded-full bg-white/90 p-2.5 shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:bg-white"
              >
                <Heart size={20} className="text-slate-600" />
              </button>
              <button
                type="button"
                aria-label={isEnglish ? 'Share tour' : '공유하기'}
                className="rounded-full bg-white/90 p-2.5 shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:bg-white"
              >
                <Share2 size={20} className="text-slate-600" />
              </button>
            </div>
            {allImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                {allImages.slice(0, 8).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`${isEnglish ? 'Go to image' : '이미지로 이동'} ${index + 1}`}
                    onClick={() => handleThumbnailSelect(index)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      selectedImageIndex === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className="border-t border-slate-100 p-4 sm:p-5"
            onMouseEnter={() => setIsAutoSlidePaused(true)}
            onMouseLeave={() => setIsAutoSlidePaused(false)}
          >
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {allImages.slice(0, 8).map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => handleThumbnailSelect(index)}
                  className={cn(
                    'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:h-20 sm:w-20',
                    selectedImageIndex === index
                      ? 'border-[#0B5FFF] ring-2 ring-[#0B5FFF]/20'
                      : 'border-transparent opacity-80 hover:opacity-100'
                  )}
                  aria-label={`${isEnglish ? 'Select image' : '이미지 선택'} ${index + 1}`}
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
          </div>
        </>
      ) : (
        <>
          <div className="relative h-72 bg-slate-100 sm:h-96 md:h-[420px]">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
              <div className="text-center px-6">
                <div className="mb-4 text-6xl" aria-hidden>
                  🏔️
                </div>
                <div className="text-lg font-semibold text-slate-700">{displayName}</div>
                <div className="mt-2 text-sm text-slate-500">
                  {isEnglish ? 'Image coming soon' : '이미지 준비 중'}
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        </>
      )}
      </div>
    </CustomerPageZone>
  )
}
