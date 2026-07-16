'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Crosshair,
  ExternalLink,
  MapPin,
  NotebookPen,
  Pencil,
  Route,
  Trash2,
  Footprints,
  Youtube,
} from 'lucide-react'
import type { PickupHotel } from '@/utils/pickupHotelUtils'
import { getAllowedPickupAccessClasses } from '@/lib/pickupHotelVehicleAccess'
import {
  PICKUP_ACCESS_CLASSES,
  normalizeAllowedPickupAccessClasses,
  type PickupAccessClass,
} from '@/lib/pickupAccessClass'
import {
  DEFAULT_PICKUP_CONTENT_LOCALE,
  getPickupLocalizedText,
  type PickupContentLocale,
} from '@/lib/pickupHotelLocales'
import PickupHotelDirectionStepsDisplay from '@/components/pickup-hotel/PickupHotelDirectionStepsDisplay'
import { PickupVehicleAccessIconRow } from '@/components/pickup-hotel/PickupVehicleIcons'
import type { PickupHotelEditSection } from '@/components/pickup-hotel/PickupHotelSectionEditModal'

interface PickupHotelCardProps {
  hotel: PickupHotel
  locale: 'ko' | 'en'
  /** Page-level content language for localized text. */
  contentLocale?: PickupContentLocale
  /** Page-level expand preference; syncs when this value changes. */
  defaultExpanded?: boolean
  onCopy: (hotel: PickupHotel) => void
  onDelete: (hotel: PickupHotel) => void
  onToggleActive: (id: string, current: boolean | null) => void
  onToggleUseForPickup: (id: string, current: boolean | null) => void
  onEditGroupNumber: (hotel: PickupHotel, e: React.MouseEvent) => void
  onOpenImages?: (images: string[], index: number, hotelName: string) => void
  onEditMedia?: (hotel: PickupHotel, initialIndex?: number) => void
  onEditSection?: (
    hotel: PickupHotel,
    section: PickupHotelEditSection
  ) => void
  onToggleVehicleAccess?: (
    hotel: PickupHotel,
    nextClasses: PickupAccessClass[] | null
  ) => void | Promise<void>
}

async function copyText(text: string, okMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    alert(okMessage)
  } catch {
    alert(okMessage)
  }
}

function shortUrl(url: string, max = 36) {
  if (url.length <= max) return url
  return `${url.slice(0, max)}…`
}

export default function PickupHotelCard({
  hotel,
  locale,
  contentLocale = DEFAULT_PICKUP_CONTENT_LOCALE,
  defaultExpanded = true,
  onCopy,
  onDelete,
  onToggleActive,
  onToggleUseForPickup,
  onEditGroupNumber,
  onOpenImages,
  onEditMedia,
  onEditSection,
  onToggleVehicleAccess,
}: PickupHotelCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [vehicleSaving, setVehicleSaving] = useState(false)
  const isEn = locale === 'en'

  useEffect(() => {
    setExpanded(defaultExpanded)
  }, [defaultExpanded])
  const media = (hotel.media || []).filter(Boolean)
  const mapImage = hotel.map_image?.trim() || null
  const gallery = mapImage ? [mapImage, ...media.filter((u) => u !== mapImage)] : media
  const [slide, setSlide] = useState(0)
  const currentImage = gallery[slide] || null

  const description = getPickupLocalizedText(hotel, 'description', contentLocale)
  const fromInside = getPickupLocalizedText(hotel, 'from_inside_hotel', contentLocale)
  const fromOutside = getPickupLocalizedText(hotel, 'from_outside_hotel', contentLocale)
  const toRepresentative = getPickupLocalizedText(
    hotel,
    'to_representative_hotel',
    contentLocale
  )

  const allowedClasses = getAllowedPickupAccessClasses(hotel)

  const handleToggleVehicleClass = async (accessClass: PickupAccessClass) => {
    if (!onToggleVehicleAccess || vehicleSaving) return
    const current = new Set(allowedClasses)
    if (current.has(accessClass)) current.delete(accessClass)
    else current.add(accessClass)
    const next = normalizeAllowedPickupAccessClasses(
      PICKUP_ACCESS_CLASSES.filter((c) => current.has(c))
    )
    setVehicleSaving(true)
    try {
      await onToggleVehicleAccess(hotel, next)
    } finally {
      setVehicleSaving(false)
    }
  }

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (gallery.length < 2) return
    setSlide((s) => (s - 1 + gallery.length) % gallery.length)
  }
  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (gallery.length < 2) return
    setSlide((s) => (s + 1) % gallery.length)
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div
        className={`px-4 py-4 sm:px-5 ${expanded ? 'border-b border-border/50' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              {hotel.hotel}
            </h3>

            <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin size={14} className="shrink-0 text-slate-400" />
              <span className="truncate">{hotel.pick_up_location || '—'}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onEditSection?.(hotel, 'basic')}
              className="rounded-lg border border-border p-2 text-slate-500 hover:bg-muted"
              title={isEn ? 'Edit basic info' : '기본 정보 수정'}
            >
              <Pencil size={16} />
            </button>
            {hotel.link && (
              <a
                href={hotel.link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border p-2 text-slate-500 hover:bg-muted"
                title="Map"
              >
                <MapPin size={16} />
              </a>
            )}
            <button
              type="button"
              onClick={() => onCopy(hotel)}
              className="rounded-lg border border-border p-2 text-slate-500 hover:bg-muted"
              title={isEn ? 'Copy' : '복사'}
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(hotel)}
              className="rounded-lg border border-border p-2 text-red-500 hover:bg-red-50"
              title={isEn ? 'Delete' : '삭제'}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div
          className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => onEditGroupNumber(hotel, e)}
            className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-200"
          >
            {hotel.group_number != null
              ? `Group ${hotel.group_number}`
              : isEn
                ? 'No group'
                : '그룹 미설정'}
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span>{isEn ? 'Active' : '활성'}</span>
            <button
              type="button"
              onClick={() => onToggleActive(hotel.id, hotel.is_active)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                hotel.is_active !== false ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  hotel.is_active !== false ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span>{isEn ? 'Pickup use' : '픽업 사용'}</span>
            <button
              type="button"
              onClick={() => onToggleUseForPickup(hotel.id, hotel.use_for_pickup ?? true)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                hotel.use_for_pickup !== false ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  hotel.use_for_pickup !== false ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-slate-600 hover:bg-muted"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? isEn
                  ? 'Collapse details'
                  : '상세 접기'
                : isEn
                  ? 'Expand details'
                  : '상세 펼치기'
            }
            title={expanded ? (isEn ? 'Collapse' : '접기') : isEn ? 'Expand' : '펼치기'}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
      {/* Body: gallery + meta */}
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
        {/* Carousel + vehicle classes */}
        <div className="flex flex-col gap-3">
          <div
            className="relative overflow-hidden rounded-xl bg-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[4/3] w-full">
              {currentImage ? (
                <Image
                  src={currentImage}
                  alt={`${hotel.hotel} ${slide + 1}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="cursor-pointer object-cover"
                  onClick={() => {
                    if (onEditMedia) onEditMedia(hotel, slide)
                    else onOpenImages?.(gallery, slide, hotel.hotel)
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-slate-200/60"
                  onClick={() => onEditMedia?.(hotel, 0)}
                >
                  <span>{isEn ? 'No image' : '이미지 없음'}</span>
                  <span className="text-xs font-medium text-blue-600">
                    {isEn ? 'Click to add' : '클릭하여 추가'}
                  </span>
                </button>
              )}

              <div
                className="absolute right-2 top-2 z-20"
                onClick={(e) => e.stopPropagation()}
              >
                <PickupVehicleAccessIconRow
                  allowed={allowedClasses}
                  locale={contentLocale === 'ko' ? 'ko' : 'en'}
                  size={24}
                  showLabels={false}
                  variant="overlay"
                  disabled={vehicleSaving}
                  {...(onToggleVehicleAccess
                    ? { onToggleClass: handleToggleVehicleClass }
                    : {})}
                />
              </div>

              {gallery.length > 0 && (
                <>
                  {gallery.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goPrev}
                        className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-white"
                        aria-label={isEn ? 'Previous image' : '이전 이미지'}
                      >
                        <ChevronLeft size={20} className="text-slate-700" />
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-white"
                        aria-label={isEn ? 'Next image' : '다음 이미지'}
                      >
                        <ChevronRight size={20} className="text-slate-700" />
                      </button>
                    </>
                  )}
                  <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex flex-col items-center gap-1.5">
                    <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white">
                      {slide + 1} / {gallery.length}
                    </span>
                    {gallery.length > 1 && (
                      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5">
                        {gallery.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSlide(i)}
                            className={`h-2 w-2 rounded-full transition ${
                              i === slide ? 'bg-blue-500' : 'bg-white/70 hover:bg-white'
                            }`}
                            aria-label={`Image ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            className="rounded-xl border border-border/60 bg-white px-3 py-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">
                {isEn ? 'Notes & media' : '메모 · 미디어'}
              </span>
              <button
                type="button"
                onClick={() => onEditSection?.(hotel, 'notes')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <Pencil size={12} />
                Edit
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Youtube size={15} className="mt-0.5 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-500">YouTube</div>
                  {hotel.youtube_link?.trim() ? (
                    <a
                      href={hotel.youtube_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-sm text-blue-600 hover:underline"
                    >
                      {shortUrl(hotel.youtube_link, 42)}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <NotebookPen size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-500">
                    {isEn ? 'Internal memo' : '내부 메모'}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-slate-700">
                    {hotel.memo?.trim() || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Meta panel */}
        <div className="flex flex-col rounded-xl border border-border/60 bg-white">
          <div className="border-b border-border/50 px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                <MapPin size={15} />
                Location Description
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEditSection?.(hotel, 'description')
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <Pencil size={12} />
                Edit
              </button>
            </div>
            <p className="rounded-lg bg-blue-50/80 px-3 py-2 text-sm leading-6 text-slate-700">
              {description || (isEn ? 'No description' : '설명 없음')}
            </p>
          </div>

          <div className="divide-y divide-border/50 px-3">
            <div
              className="flex items-center justify-between gap-2 py-2"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-xs font-semibold text-slate-600">
                {isEn ? 'Location details' : '위치 정보'}
              </span>
              <button
                type="button"
                onClick={() => onEditSection?.(hotel, 'location')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <Pencil size={12} />
                Edit
              </button>
            </div>
            <MetaRow
              icon={<MapPin size={15} className="text-blue-500" />}
              label="Address"
              value={hotel.address || '—'}
              onCopy={
                hotel.address
                  ? () =>
                      copyText(
                        hotel.address!,
                        isEn ? 'Address copied' : '주소가 복사되었습니다.'
                      )
                  : undefined
              }
            />
            <MetaRow
              icon={<Crosshair size={15} className="text-blue-500" />}
              label="Coordinates"
              value={hotel.pin || '—'}
              onCopy={
                hotel.pin
                  ? () =>
                      copyText(hotel.pin!, isEn ? 'Coordinates copied' : '좌표가 복사되었습니다.')
                  : undefined
              }
            />
            <div className="flex items-start gap-2 py-2.5" onClick={(e) => e.stopPropagation()}>
              <span className="mt-0.5">{<MapPin size={15} className="text-blue-500" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium text-slate-500">Google Maps</div>
                  {hotel.link && (
                    <div className="ml-auto flex shrink-0 items-center gap-0.5">
                      <a
                        href={hotel.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-muted hover:text-slate-800"
                        title={isEn ? 'Open' : '열기'}
                        aria-label={isEn ? 'Open Google Maps' : 'Google Maps 열기'}
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(hotel.link!, isEn ? 'Link copied' : '링크가 복사되었습니다.')
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-muted hover:text-slate-800"
                        title={isEn ? 'Copy' : '복사'}
                        aria-label={isEn ? 'Copy Google Maps link' : 'Google Maps 링크 복사'}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {hotel.link ? (
                  <a
                    href={hotel.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-sm text-blue-600 hover:underline"
                  >
                    {shortUrl(hotel.link)}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
            {hotel.landmark && (
              <MetaRow
                icon={<Building2 size={15} className="text-blue-500" />}
                label={isEn ? 'Landmark' : '랜드마크'}
                value={hotel.landmark}
              />
            )}
          </div>
        </div>
      </div>

      {/* Directions */}
      <div className="grid gap-3 border-t border-border/50 p-4 sm:grid-cols-2 sm:p-5">
        <DirectionPanel
          title="From Inside Hotel"
          accent="blue"
          icon={<Building2 size={16} />}
          text={fromInside}
          emptyLabel={isEn ? 'No directions' : '안내 없음'}
          onEdit={(e) => {
            e.stopPropagation()
            onEditSection?.(hotel, 'inside')
          }}
        />
        <DirectionPanel
          title="From Outside Hotel"
          accent="green"
          icon={<Footprints size={16} />}
          text={fromOutside}
          emptyLabel={isEn ? 'No directions' : '안내 없음'}
          onEdit={(e) => {
            e.stopPropagation()
            onEditSection?.(hotel, 'outside')
          }}
        />
      </div>

      {/* To representative */}
      {(toRepresentative || hotel.group_number != null) && (
        <div className="border-t border-border/50 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
          <DirectionPanel
            title={isEn ? 'To Representative Hotel' : '대표 호텔 이동 안내'}
            accent="blue"
            icon={<Route size={16} />}
            text={toRepresentative}
            emptyLabel={isEn ? 'No directions yet' : '아직 작성되지 않음'}
            onEdit={(e) => {
              e.stopPropagation()
              onEditSection?.(hotel, 'toRepresentative')
            }}
          />
        </div>
      )}
        </>
      )}
    </article>
  )
}

function MetaRow({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onCopy?: (() => void) | undefined
}) {
  return (
    <div className="flex items-start gap-2 py-2.5" onClick={(e) => e.stopPropagation()}>
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-0.5 break-words text-sm text-slate-800">{value}</div>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-muted hover:text-slate-700"
          title="Copy"
        >
          <Copy size={14} />
        </button>
      )}
    </div>
  )
}

function DirectionPanel({
  title,
  accent,
  icon,
  text,
  emptyLabel,
  onEdit,
}: {
  title: string
  accent: 'blue' | 'green'
  icon: React.ReactNode
  text: string | null | undefined
  emptyLabel: string
  onEdit: (e: React.MouseEvent) => void
}) {
  const headerBg = accent === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
  const editColor = accent === 'green' ? 'text-emerald-600' : 'text-blue-600'

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
      <div className={`flex items-center justify-between gap-2 px-3 py-2.5 ${headerBg}`}>
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${editColor}`}
        >
          <Pencil size={12} />
          Edit
        </button>
      </div>
      <div className="px-3 py-3">
        <PickupHotelDirectionStepsDisplay text={text} accent={accent} emptyLabel={emptyLabel} />
      </div>
    </div>
  )
}
