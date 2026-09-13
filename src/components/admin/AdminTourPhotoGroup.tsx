'use client'

import { EyeOff, ExternalLink, Users } from 'lucide-react'
import { TourPhotoMediaThumb } from '@/components/tour/TourPhotoMedia'
import AdminTourPhotoStarButton from '@/components/admin/AdminTourPhotoStarButton'
import type { AdminGalleryTourGroup } from '@/lib/adminTourPhotos'

const PREVIEW_COUNT = 12

type AdminTourPhotoGroupProps = {
  group: AdminGalleryTourGroup
  dateLabel: string
  photoCountLabel: string
  assignedPeopleLabel: string
  guideLabel: string
  assistantLabel: string
  noGuideLabel: string
  openTourLabel: string
  showMoreLabel: string
  showLessLabel: string
  hiddenBadge: string
  favoriteAddLabel: string
  favoriteRemoveLabel: string
  favoriteIds: Set<string>
  expanded: boolean
  onToggleExpand: () => void
  onOpenTour: () => void
  onSelectPhoto: (photoId: string) => void
  onToggleFavorite: (photoId: string) => void
}

export default function AdminTourPhotoGroup({
  group,
  dateLabel,
  photoCountLabel,
  assignedPeopleLabel,
  guideLabel,
  assistantLabel,
  noGuideLabel,
  openTourLabel,
  showMoreLabel,
  showLessLabel,
  hiddenBadge,
  favoriteAddLabel,
  favoriteRemoveLabel,
  favoriteIds,
  expanded,
  onToggleExpand,
  onOpenTour,
  onSelectPhoto,
  onToggleFavorite,
}: AdminTourPhotoGroupProps) {
  const visible = expanded ? group.photos : group.photos.slice(0, PREVIEW_COUNT)
  const hiddenCount = group.photos.length - PREVIEW_COUNT
  const staffLine = [
    `${guideLabel} ${group.guideName || noGuideLabel}`,
    group.assistantName ? `${assistantLabel} ${group.assistantName}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <section className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{group.productName}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{dateLabel} · {photoCountLabel}</span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {assignedPeopleLabel}
            </span>
          </p>
          <p className="mt-1 text-sm text-gray-700">{staffLine}</p>
        </div>
        <button
          type="button"
          onClick={onOpenTour}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-input px-4 text-sm font-medium text-gray-800 hover:bg-accent"
        >
          <ExternalLink className="h-4 w-4" />
          {openTourLabel}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {visible.map((photo) => (
          <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted">
            <button
              type="button"
              onClick={() => onSelectPhoto(photo.id)}
              className="group h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={photo.fileName}
            >
              <TourPhotoMediaThumb
                filePath={photo.filePath}
                fileName={photo.fileName}
                thumbnailPath={photo.thumbnailPath}
                mimeType={photo.mimeType}
                alt={photo.fileName}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
            </button>
            {photo.hiddenByAdmin && (
              <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white">
                <EyeOff className="h-3 w-3" />
                {hiddenBadge}
              </span>
            )}
            <AdminTourPhotoStarButton
              isFavorite={favoriteIds.has(photo.id)}
              addLabel={favoriteAddLabel}
              removeLabel={favoriteRemoveLabel}
              onToggle={() => onToggleFavorite(photo.id)}
            />
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {expanded ? showLessLabel : showMoreLabel}
          </button>
        </div>
      )}
    </section>
  )
}
