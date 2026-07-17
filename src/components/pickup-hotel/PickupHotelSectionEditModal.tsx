'use client'

import { useEffect, useState } from 'react'
import { Building2, Footprints, Loader2, MapPin, Route, X } from 'lucide-react'
import type { PickupHotel } from '@/utils/pickupHotelUtils'
import { findRoundedGroupHotel } from '@/utils/pickupHotelUtils'
import type { PickupAccessClass } from '@/lib/pickupAccessClass'
import {
  parseDirectionSteps,
  serializeDirectionSteps,
} from '@/lib/pickupHotelDirectionSteps'
import {
  DEFAULT_PICKUP_CONTENT_LOCALE,
  getPickupContentLocaleMeta,
  getPickupI18nMap,
  mergeHotelI18n,
  type PickupContentLocale,
} from '@/lib/pickupHotelLocales'
import PickupHotelDirectionStepsEditor from '@/components/pickup-hotel/PickupHotelDirectionStepsEditor'
import PickupHotelVehicleAccessSelect from '@/components/pickup-hotel/PickupHotelVehicleAccessSelect'
import PickupContentLocaleDropdown from '@/components/pickup-hotel/PickupContentLocaleDropdown'

export type PickupHotelEditSection =
  | 'basic'
  | 'description'
  | 'location'
  | 'vehicle'
  | 'notes'
  | 'inside'
  | 'outside'
  | 'toRepresentative'

export const PICKUP_HOTEL_SECTION_TITLES: Record<
  PickupHotelEditSection,
  { ko: string; en: string }
> = {
  basic: { ko: '기본 정보', en: 'Basic Info' },
  description: { ko: '위치 설명', en: 'Location Description' },
  location: { ko: '위치 정보', en: 'Location Info' },
  vehicle: { ko: '차량 이용 안내', en: 'Vehicle Access' },
  notes: { ko: '메모 · 미디어', en: 'Notes & Media' },
  inside: { ko: '호텔 내부에서', en: 'From Inside Hotel' },
  outside: { ko: '호텔 외부에서', en: 'From Outside Hotel' },
  toRepresentative: { ko: '대표 호텔 이동 안내', en: 'To Representative Hotel' },
}

type SectionPatch = Partial<PickupHotel>

interface PickupHotelSectionEditModalProps {
  hotel: PickupHotel
  section: PickupHotelEditSection
  allHotels?: PickupHotel[]
  locale?: 'ko' | 'en'
  contentLocale?: PickupContentLocale
  onClose: () => void
  onSave: (hotelId: string, patch: SectionPatch) => Promise<void>
}

const inputClass =
  'h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'
const textareaClass =
  'w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'

const I18N_SECTIONS: PickupHotelEditSection[] = [
  'description',
  'inside',
  'outside',
  'toRepresentative',
]

export default function PickupHotelSectionEditModal({
  hotel,
  section,
  allHotels = [],
  locale = 'ko',
  contentLocale: contentLocaleProp = DEFAULT_PICKUP_CONTENT_LOCALE,
  onClose,
  onSave,
}: PickupHotelSectionEditModalProps) {
  const isEn = locale === 'en'
  const title = PICKUP_HOTEL_SECTION_TITLES[section][isEn ? 'en' : 'ko']
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editLocale, setEditLocale] = useState<PickupContentLocale>(contentLocaleProp)

  const [hotelName, setHotelName] = useState(hotel.hotel || '')
  const [internalName, setInternalName] = useState(hotel.internal_name || '')
  const [pickUpLocation, setPickUpLocation] = useState(hotel.pick_up_location || '')
  const [groupNumber, setGroupNumber] = useState<number | null>(hotel.group_number)
  const [descriptionText, setDescriptionText] = useState('')
  const [address, setAddress] = useState(hotel.address || '')
  const [pin, setPin] = useState(hotel.pin || '')
  const [link, setLink] = useState(hotel.link || '')
  const [landmark, setLandmark] = useState(hotel.landmark || '')
  const [vehicleClasses, setVehicleClasses] = useState<PickupAccessClass[] | null>(
    hotel.allowed_pickup_access_classes
  )
  const [youtubeLink, setYoutubeLink] = useState(hotel.youtube_link || '')
  const [memo, setMemo] = useState(hotel.memo || '')
  const [directionSteps, setDirectionSteps] = useState<string[]>([])
  const [toRepText, setToRepText] = useState('')

  useEffect(() => {
    setEditLocale(contentLocaleProp)
  }, [contentLocaleProp, section, hotel.id])

  useEffect(() => {
    setHotelName(hotel.hotel || '')
    setInternalName(hotel.internal_name || '')
    setPickUpLocation(hotel.pick_up_location || '')
    setGroupNumber(hotel.group_number)
    setAddress(hotel.address || '')
    setPin(hotel.pin || '')
    setLink(hotel.link || '')
    setLandmark(hotel.landmark || '')
    setVehicleClasses(hotel.allowed_pickup_access_classes)
    setYoutubeLink(hotel.youtube_link || '')
    setMemo(hotel.memo || '')
    setError(null)
  }, [hotel, section])

  useEffect(() => {
    setDescriptionText(getPickupI18nMap(hotel, 'description')[editLocale] || '')
    setToRepText(getPickupI18nMap(hotel, 'to_representative_hotel')[editLocale] || '')
    const inside = getPickupI18nMap(hotel, 'from_inside_hotel')[editLocale] || ''
    const outside = getPickupI18nMap(hotel, 'from_outside_hotel')[editLocale] || ''
    if (section === 'inside') setDirectionSteps(parseDirectionSteps(inside))
    if (section === 'outside') setDirectionSteps(parseDirectionSteps(outside))
  }, [hotel, section, editLocale])

  const representativeHotel =
    groupNumber != null ? findRoundedGroupHotel(groupNumber, allHotels) : null
  const editLocaleLabel = getPickupContentLocaleMeta(editLocale).label

  const buildPatch = (): SectionPatch => {
    switch (section) {
      case 'basic':
        return {
          hotel: hotelName.trim(),
          internal_name: internalName.trim() || null,
          pick_up_location: pickUpLocation.trim(),
          group_number: groupNumber,
        }
      case 'description':
        return mergeHotelI18n(hotel, 'description', editLocale, descriptionText)
      case 'location':
        return {
          address: address.trim() || null,
          pin: pin.trim() || null,
          link: link.trim() || null,
          landmark: landmark.trim() || null,
        }
      case 'vehicle':
        return { allowed_pickup_access_classes: vehicleClasses }
      case 'notes':
        return {
          youtube_link: youtubeLink.trim() || null,
          memo: memo.trim() || null,
        }
      case 'inside':
        return mergeHotelI18n(
          hotel,
          'from_inside_hotel',
          editLocale,
          serializeDirectionSteps(directionSteps)
        )
      case 'outside':
        return mergeHotelI18n(
          hotel,
          'from_outside_hotel',
          editLocale,
          serializeDirectionSteps(directionSteps)
        )
      case 'toRepresentative':
        return mergeHotelI18n(hotel, 'to_representative_hotel', editLocale, toRepText)
      default:
        return {}
    }
  }

  const handleSave = async () => {
    if (section === 'basic') {
      if (!hotelName.trim() || !pickUpLocation.trim()) {
        setError(isEn ? 'Hotel name and pickup location are required.' : '호텔명과 픽업 위치는 필수입니다.')
        return
      }
    }
    if (section === 'location' && !address.trim()) {
      setError(isEn ? 'Address is required.' : '주소는 필수입니다.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(hotel.id, buildPatch())
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? 'Save failed.' : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10020] flex items-start justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm">
      <div className="relative my-[calc(var(--header-height,4rem)+0.75rem)] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="truncate text-xs text-muted-foreground">{hotel.hotel}</p>
          </div>
          <div className="flex items-center gap-2">
            {I18N_SECTIONS.includes(section) && (
              <PickupContentLocaleDropdown
                value={editLocale}
                onChange={setEditLocale}
                size="md"
              />
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={isEn ? 'Close' : '닫기'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="max-h-[min(70vh,560px)] space-y-3 overflow-y-auto px-4 py-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {I18N_SECTIONS.includes(section) && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {isEn
                ? `Editing: ${editLocaleLabel}. Switch language above to fill other locales.`
                : `편집 중: ${editLocaleLabel}. 위 언어를 바꿔 다른 언어도 입력할 수 있습니다.`}
            </p>
          )}

          {section === 'basic' && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold">{isEn ? 'Hotel' : '호텔 이름'}</label>
                <input className={inputClass} value={hotelName} onChange={(e) => setHotelName(e.target.value)} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isEn ? 'Full name shown to customers' : '고객 안내에 표시되는 전체 이름'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold">
                  {isEn ? 'Internal name' : '내부용 이름'}
                </label>
                <input
                  className={inputClass}
                  value={internalName}
                  onChange={(e) => setInternalName(e.target.value)}
                  placeholder={isEn ? 'e.g. Bellagio' : '예: 벨라지오'}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isEn
                    ? 'Used only on assignment reservation cards. Falls back to the full name when blank.'
                    : '배정 관리 예약 카드에만 표시되며, 비워두면 전체 이름을 사용합니다.'}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">{isEn ? 'Pickup location' : '픽업 위치'}</label>
                <input className={inputClass} value={pickUpLocation} onChange={(e) => setPickUpLocation(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">{isEn ? 'Group number' : '그룹 번호'}</label>
                <input
                  type="number"
                  step="0.1"
                  className={inputClass}
                  value={groupNumber ?? ''}
                  onChange={(e) => setGroupNumber(e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
          )}

          {section === 'description' && (
            <div>
              <label className="mb-1 block text-xs font-semibold">{editLocaleLabel}</label>
              <textarea
                rows={6}
                className={textareaClass}
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
              />
            </div>
          )}

          {section === 'location' && (
            <div className="space-y-2.5">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-semibold">
                  <MapPin size={12} /> {isEn ? 'Address' : '주소'}
                </label>
                <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">{isEn ? 'Coordinates' : '좌표'}</label>
                <input className={inputClass} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="36.1699, -115.1398" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Google Maps</label>
                <input className={inputClass} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://maps.google.com/..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">{isEn ? 'Landmark' : '랜드마크'}</label>
                <input className={inputClass} value={landmark} onChange={(e) => setLandmark(e.target.value)} />
              </div>
            </div>
          )}

          {section === 'vehicle' && (
            <PickupHotelVehicleAccessSelect
              value={vehicleClasses}
              onChange={setVehicleClasses}
              locale={locale}
            />
          )}

          {section === 'notes' && (
            <div className="space-y-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold">YouTube</label>
                <input
                  type="url"
                  className={inputClass}
                  value={youtubeLink}
                  onChange={(e) => setYoutubeLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  {isEn ? 'Internal memo' : '내부 메모'}
                </label>
                <textarea
                  rows={4}
                  className={textareaClass}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder={isEn ? 'Internal notes for operations' : '운영팀만 확인할 수 있는 메모'}
                />
              </div>
            </div>
          )}

          {(section === 'inside' || section === 'outside') && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {section === 'inside' ? <Building2 size={16} /> : <Footprints size={16} />}
                {title}
                <span className="text-xs font-medium text-muted-foreground">({editLocaleLabel})</span>
              </div>
              <PickupHotelDirectionStepsEditor
                steps={directionSteps}
                accent={section === 'outside' ? 'green' : 'blue'}
                onChange={setDirectionSteps}
              />
            </div>
          )}

          {section === 'toRepresentative' && (
            <div className="space-y-2.5">
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Route size={14} />
                  {representativeHotel
                    ? `${isEn ? 'Representative' : '대표'}: ${representativeHotel.hotel}`
                    : isEn
                      ? 'No representative hotel found for this group.'
                      : '이 그룹의 대표 호텔을 찾지 못했습니다.'}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">{editLocaleLabel}</label>
                <textarea
                  rows={6}
                  className={textareaClass}
                  value={toRepText}
                  onChange={(e) => setToRepText(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {isEn ? 'Cancel' : '취소'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEn ? 'Save' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
