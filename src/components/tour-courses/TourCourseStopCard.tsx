'use client'

import { useState, type HTMLAttributes, type ReactNode } from 'react'
import { GripVertical, ImageIcon, Pencil, Trash2 } from 'lucide-react'
import { markdownToHtml } from '@/components/LightRichEditor'
import type { TourCourse } from '@/components/product/productDetailTypes'
import { getPrimaryTourCoursePhoto, getTourCoursePhotoPublicUrl } from '@/lib/tourCoursePhotoUrl'
import { cn } from '@/lib/utils'

export type TourCourseStopCardProps = {
  course: TourCourse
  title: string
  description: string
  photos?: Array<{
    id: string
    course_id: string
    photo_url: string
    photo_alt_ko: string | null
    photo_alt_en: string | null
    display_order: number
    is_primary: boolean
    sort_order: number
    thumbnail_url: string | null
  }>
  imageAlt?: string
  moreLabel?: string
  lessLabel?: string
  variant?: 'customer' | 'editor'
  compact?: boolean
  selected?: boolean
  hiddenFromCustomer?: boolean
  hiddenLabel?: string
  clickToEditLabel?: string
  isDragging?: boolean
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>
  onOpen?: () => void
  onRemove?: () => void
  removeLabel?: string
  footer?: ReactNode
  actions?: ReactNode
}

export default function TourCourseStopCard({
  course,
  title,
  description,
  photos,
  imageAlt = 'Tour course',
  moreLabel = 'More',
  lessLabel = 'Less',
  variant = 'customer',
  compact = false,
  selected = false,
  hiddenFromCustomer = false,
  hiddenLabel,
  clickToEditLabel,
  isDragging = false,
  dragHandleProps,
  onOpen,
  onRemove,
  removeLabel,
  footer,
  actions,
}: TourCourseStopCardProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const isEditor = variant === 'editor'
  const hasDescription = Boolean(description?.trim())
  const primaryPhoto = getPrimaryTourCoursePhoto(photos || course.photos || [])
  const photoUrl = getTourCoursePhotoPublicUrl(primaryPhoto)

  return (
    <div
      className={cn(
        'group relative border-b border-slate-100 last:border-b-0',
        compact ? 'py-3' : 'py-4',
        isEditor && 'rounded-xl border border-transparent px-2 transition duration-200 hover:border-border/80 hover:bg-muted/30 hover:shadow-sm',
        selected && 'border-primary/40 bg-primary/5',
        isDragging && 'rounded-xl border-primary/40 bg-white shadow-lg ring-2 ring-primary/20'
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:items-start',
          compact ? 'sm:gap-3' : 'sm:gap-4',
          isEditor && 'cursor-pointer'
        )}
        onClick={isEditor ? onOpen : undefined}
      >
        {isEditor && dragHandleProps ? (
          <button
            type="button"
            className="hidden shrink-0 cursor-grab touch-manipulation pt-2 text-muted-foreground hover:text-foreground active:cursor-grabbing sm:block"
            aria-label="Reorder"
            onClick={(event) => event.stopPropagation()}
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}

        {photoUrl ? (
          <div className={cn('w-full shrink-0', compact ? 'sm:w-28 lg:w-32' : 'sm:w-40 lg:w-48')}>
            <img
              src={photoUrl}
              alt={title || imageAlt}
              className={cn(
                'w-full rounded-lg object-cover',
                compact ? 'h-28 sm:h-20' : 'h-40 sm:h-32'
              )}
            />
          </div>
        ) : isEditor ? (
          <div
            className={cn(
              'flex w-full shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
              compact ? 'h-28 sm:h-20 sm:w-28 lg:w-32' : 'h-40 sm:h-32 sm:w-40 lg:w-48'
            )}
          >
            <ImageIcon className="h-6 w-6" aria-hidden />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {title.trim() ? (
                <div
                  className={cn(
                    'font-semibold text-gray-900',
                    compact ? 'text-sm' : 'text-sm sm:mb-2 sm:text-base'
                  )}
                >
                  {title}
                </div>
              ) : null}
              {hiddenFromCustomer && hiddenLabel ? (
                <span className="mt-1 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {hiddenLabel}
                </span>
              ) : null}
            </div>
            {hasDescription && !isEditor && !compact ? (
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-booking underline underline-offset-2 sm:hidden"
                onClick={() => setMobileExpanded((current) => !current)}
                aria-expanded={mobileExpanded}
              >
                {mobileExpanded ? lessLabel : moreLabel}
              </button>
            ) : null}
          </div>

          {hasDescription ? (
            <div
              className={cn(
                'text-xs leading-relaxed text-gray-700 sm:mt-0 sm:text-sm',
                !isEditor && !compact && (mobileExpanded ? 'mt-1.5 block' : 'hidden sm:block')
              )}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(description) }}
            />
          ) : isEditor ? (
            <p className="text-xs text-muted-foreground">{clickToEditLabel}</p>
          ) : null}

          {footer ? <div onClick={(event) => event.stopPropagation()}>{footer}</div> : null}
        </div>
      </div>

      {isEditor ? (
        <div
          className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/95 p-1 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={clickToEditLabel || 'Edit'}
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
              aria-label={removeLabel || 'Remove'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
