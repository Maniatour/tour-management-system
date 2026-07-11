'use client'

import CustomerPageZone from '@/components/product/CustomerPageZone'
import { GALLERY_PLACEHOLDER_CLASSES } from '@/components/home/homeExtendedSectionData'

export type GalleryStructureVariant = 'grid-four' | 'masonry' | 'horizontal-scroll' | 'featured-plus-grid'

export default function HomeGallerySectionView({
  variant,
  t,
  zoneId,
  titleOverride,
  itemCount = 6,
}: {
  variant: GalleryStructureVariant
  t: (key: string) => string
  zoneId: string
  titleOverride?: string
  itemCount?: number
}) {
  const count = Math.min(12, Math.max(1, itemCount))
  const title = titleOverride?.trim() || t('galleryTitle')

  if (variant === 'horizontal-scroll') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-6">{title}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className={`shrink-0 h-32 w-48 rounded-feature ${GALLERY_PLACEHOLDER_CLASSES[i % GALLERY_PLACEHOLDER_CLASSES.length]}`}
              />
            ))}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'featured-plus-grid') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-6">{title}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div
              className={`min-h-56 rounded-feature md:row-span-2 ${GALLERY_PLACEHOLDER_CLASSES[0]}`}
            />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: Math.min(4, count - 1) }).map((_, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-xl ${GALLERY_PLACEHOLDER_CLASSES[(i + 1) % GALLERY_PLACEHOLDER_CLASSES.length]}`}
                />
              ))}
            </div>
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'masonry') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold text-center mb-8">{title}</h2>
          <div className="columns-2 md:columns-3 gap-3 space-y-3">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className={`break-inside-avoid rounded-xl ${GALLERY_PLACEHOLDER_CLASSES[i % GALLERY_PLACEHOLDER_CLASSES.length]} ${i % 3 === 0 ? 'h-40' : 'h-28'}`}
              />
            ))}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-center mb-2">{title}</h2>
        <p className="text-center cp-ui-muted mb-8">{t('galleryDesc')}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className={`aspect-[4/3] rounded-xl ${GALLERY_PLACEHOLDER_CLASSES[i % GALLERY_PLACEHOLDER_CLASSES.length]}`}
            />
          ))}
        </div>
      </div>
    </CustomerPageZone>
  )
}
