'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Heart, Share2 } from 'lucide-react'
import type { ProductMedia, TourCoursePhoto } from '@/components/product/productDetailTypes'
import CustomerPageZone from '@/components/product/CustomerPageZone'

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
    <CustomerPageZone zone="detail-gallery" className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {allImages.length > 0 ? (
        <>
          <div
            className="relative w-full h-[600px] bg-gray-200 flex items-center justify-center"
            onMouseEnter={() => setIsAutoSlidePaused(true)}
            onMouseLeave={() => setIsAutoSlidePaused(false)}
          >
            <Image
              src={allImages[selectedImageIndex].file_url}
              alt={allImages[selectedImageIndex].alt_text || allImages[selectedImageIndex].file_name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px"
              priority
              className="object-contain transition-opacity duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            <div className="absolute top-4 right-4 flex space-x-2 z-10">
              <button type="button" className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                <Heart size={20} className="text-gray-600" />
              </button>
              <button type="button" className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                <Share2 size={20} className="text-gray-600" />
              </button>
            </div>
          </div>

          <div
            className="p-4"
            onMouseEnter={() => setIsAutoSlidePaused(true)}
            onMouseLeave={() => setIsAutoSlidePaused(false)}
          >
            <div className="flex space-x-2 overflow-x-auto">
              {allImages.slice(0, 8).map((image, index) => (
                <div
                  key={image.id}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-200 relative border-2 ${
                    selectedImageIndex === index ? 'border-blue-500' : 'border-transparent'
                  }`}
                >
                  <Image
                    src={image.file_url}
                    alt={image.alt_text || image.file_name}
                    fill
                    sizes="80px"
                    className="object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleThumbnailSelect(index)}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="relative h-96 bg-gray-200">
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🏔️</div>
                <div className="text-lg font-medium text-gray-600">{displayName}</div>
                <div className="text-sm text-gray-500 mt-2">
                  {isEnglish ? 'Image coming soon' : '이미지 준비 중'}
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            <div className="absolute top-4 right-4 flex space-x-2">
              <button type="button" className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                <Heart size={20} className="text-gray-600" />
              </button>
              <button type="button" className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                <Share2 size={20} className="text-gray-600" />
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="flex space-x-2 overflow-x-auto">
              <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                {isEnglish ? 'No image' : '이미지 없음'}
              </div>
            </div>
          </div>
        </>
      )}
    </CustomerPageZone>
  )
}
