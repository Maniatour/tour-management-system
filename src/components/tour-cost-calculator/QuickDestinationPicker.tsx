'use client'

import { useState } from 'react'
import { CalendarDays, Car, Flag, Hotel, IdCard, MapPin, Minus, Navigation, Plane, PlaneTakeoff, Plus, Ticket } from 'lucide-react'
import {
  getRepresentativeTourCourses,
  groupRepresentativeTourCourses,
  matchesCourseSearch,
  type RepresentativeCourseLike,
} from '@/lib/representativeTourCourses'
import {
  QUICK_HOTEL_HIGH_RATE,
  QUICK_HOTEL_LOW_RATE,
  type QuickHotelSeason,
  type QuickQuoteCity,
} from '@/lib/quickQuoteWaypoints'
import QuickEntranceFeePopover from '@/components/tour-cost-calculator/QuickEntranceFeePopover'
import type { QuickAddonId } from '@/lib/quickQuoteAddons'

export type QuickQuoteAddonButton = {
  id: QuickAddonId
  label: string
  rate: number
  selected: boolean
  qty: number
  qtyLabel: string
}

export type QuickDestinationCourse = RepresentativeCourseLike & {
  price_type?: string | null
  price_adult?: number | null
  price_minivan?: number | null
  price_9seater?: number | null
  price_13seater?: number | null
}

type QuickDestinationPickerProps = {
  courses: QuickDestinationCourse[]
  selectedCourses: Set<string>
  searchTerm: string
  locale: string
  standaloneGroupLabel: string
  emptyLabel: string
  departure: QuickQuoteCity | null
  arrival: QuickQuoteCity | null
  hotelSeason: QuickHotelSeason | null
  hotelCustomerRooms: number
  hotelNights: number
  stayNights: number
  stayOptions: Array<{ nights: number; label: string }>
  labels: {
    originGroup: string
    stayGroup: string
    hotelGroup: string
    addonGroup: string
    addonQty: string
    lvDepart: string
    lvArrive: string
    laDepart: string
    laArrive: string
    hotelHigh: string
    hotelLow: string
    customerRooms: string
    guideRoomIncluded: string
    totalRooms: string
    feeTitle: string
    feePerPerson: string
    feeSave: string
    feeCancel: string
    feeClear: string
    feeContextHint: string
    addonFeeContextHint: string
  }
  addons: QuickQuoteAddonButton[]
  feeSaving?: boolean
  onSelect: (courseId: string) => void
  onDeselect: (courseId: string) => void
  onToggleDeparture: (city: QuickQuoteCity) => void
  onToggleArrival: (city: QuickQuoteCity) => void
  onToggleHotel: (season: QuickHotelSeason) => void
  onHotelRoomsChange: (rooms: number) => void
  onStayNightsChange: (nights: number) => void
  onToggleAddon: (id: QuickAddonId) => void
  onAddonQtyChange: (id: QuickAddonId, qty: number) => void
  onSaveAddonRate: (id: QuickAddonId, rate: number | null) => void
  onSaveEntranceFee: (courseId: string, priceAdult: number | null) => void
}

function courseLabel(course: QuickDestinationCourse, locale: string): string {
  if (locale === 'en') return course.name_en || course.name_ko || ''
  return course.name_ko || course.name_en || ''
}

function coursePriceHint(course: QuickDestinationCourse): string | null {
  if (course.price_type === 'per_vehicle') {
    const price = course.price_minivan || course.price_9seater || course.price_13seater
    return price ? `$${price}` : null
  }
  return course.price_adult ? `$${course.price_adult}` : null
}

function chipClass(selected: boolean): string {
  return `inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
    selected
      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
      : 'border-border/80 bg-white text-gray-800 hover:border-primary/40 hover:bg-primary/5'
  }`
}

function addonIcon(id: QuickAddonId, selected: boolean) {
  const className = `h-4 w-4 flex-shrink-0 ${selected ? 'opacity-90' : 'text-muted-foreground'}`
  if (id === 'nonResident') return <IdCard className={className} />
  if (id === 'passPurchase') return <Ticket className={className} />
  if (id === 'gcHelicopter') return <Plane className={className} />
  if (id === 'gcAircraft') return <PlaneTakeoff className={className} />
  return <Car className={className} />
}

export default function QuickDestinationPicker({
  courses,
  selectedCourses,
  searchTerm,
  locale,
  standaloneGroupLabel,
  emptyLabel,
  departure,
  arrival,
  hotelSeason,
  hotelCustomerRooms,
  stayNights,
  stayOptions,
  addons,
  labels,
  onSelect,
  onDeselect,
  onToggleDeparture,
  onToggleArrival,
  onToggleHotel,
  onHotelRoomsChange,
  onStayNightsChange,
  onToggleAddon,
  onAddonQtyChange,
  onSaveAddonRate,
  onSaveEntranceFee,
  feeSaving = false,
}: QuickDestinationPickerProps) {
  const [feeEditor, setFeeEditor] = useState<{
    course: QuickDestinationCourse
    x: number
    y: number
  } | null>(null)
  const [addonFeeEditor, setAddonFeeEditor] = useState<{
    addon: QuickQuoteAddonButton
    x: number
    y: number
  } | null>(null)
  const representatives = getRepresentativeTourCourses(courses).filter((course) => {
    if (matchesCourseSearch(course, searchTerm)) return true
    const parent = courses.find((item) => item.id === course.parent_id)
    return parent ? matchesCourseSearch(parent, searchTerm) : false
  })
  const groups = groupRepresentativeTourCourses(representatives, courses)

  return (
    <>
    <div className="max-h-[28rem] sm:max-h-[32rem] overflow-y-auto space-y-5 -mx-1 px-1">
      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
          {labels.originGroup}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={departure === 'lv'} onClick={() => onToggleDeparture('lv')} className={chipClass(departure === 'lv')}>
            <Navigation className={`h-4 w-4 flex-shrink-0 ${departure === 'lv' ? 'opacity-90' : 'text-muted-foreground'}`} />
            {labels.lvDepart}
          </button>
          <button type="button" aria-pressed={arrival === 'lv'} onClick={() => onToggleArrival('lv')} className={chipClass(arrival === 'lv')}>
            <Flag className={`h-4 w-4 flex-shrink-0 ${arrival === 'lv' ? 'opacity-90' : 'text-muted-foreground'}`} />
            {labels.lvArrive}
          </button>
          <button type="button" aria-pressed={departure === 'la'} onClick={() => onToggleDeparture('la')} className={chipClass(departure === 'la')}>
            <Navigation className={`h-4 w-4 flex-shrink-0 ${departure === 'la' ? 'opacity-90' : 'text-muted-foreground'}`} />
            {labels.laDepart}
          </button>
          <button type="button" aria-pressed={arrival === 'la'} onClick={() => onToggleArrival('la')} className={chipClass(arrival === 'la')}>
            <Flag className={`h-4 w-4 flex-shrink-0 ${arrival === 'la' ? 'opacity-90' : 'text-muted-foreground'}`} />
            {labels.laArrive}
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
          {labels.stayGroup}
        </div>
        <div className="flex flex-wrap gap-2">
          {stayOptions.map((option) => (
            <button
              key={option.nights}
              type="button"
              aria-pressed={stayNights === option.nights}
              onClick={() => onStayNightsChange(option.nights)}
              className={chipClass(stayNights === option.nights)}
            >
              <CalendarDays className={`h-4 w-4 flex-shrink-0 ${stayNights === option.nights ? 'opacity-90' : 'text-muted-foreground'}`} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
          {labels.hotelGroup}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={hotelSeason === 'high'} onClick={() => onToggleHotel('high')} className={chipClass(hotelSeason === 'high')}>
            <Hotel className={`h-4 w-4 flex-shrink-0 ${hotelSeason === 'high' ? 'opacity-90' : 'text-muted-foreground'}`} />
            {labels.hotelHigh}
            <span className={`text-xs font-medium ${hotelSeason === 'high' ? 'opacity-90' : 'text-muted-foreground'}`}>
              ${QUICK_HOTEL_HIGH_RATE}
            </span>
          </button>
          <button type="button" aria-pressed={hotelSeason === 'low'} onClick={() => onToggleHotel('low')} className={chipClass(hotelSeason === 'low')}>
            <Hotel className={`h-4 w-4 flex-shrink-0 ${hotelSeason === 'low' ? 'opacity-90' : 'text-muted-foreground'}`} />
            {labels.hotelLow}
            <span className={`text-xs font-medium ${hotelSeason === 'low' ? 'opacity-90' : 'text-muted-foreground'}`}>
              ${QUICK_HOTEL_LOW_RATE}
            </span>
          </button>
        </div>
        {hotelSeason ? (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{labels.customerRooms}</span>
              <div className="inline-flex items-center rounded-lg border border-border bg-white">
                <button
                  type="button"
                  onClick={() => onHotelRoomsChange(Math.max(1, hotelCustomerRooms - 1))}
                  className="inline-flex h-9 w-9 items-center justify-center text-gray-600 hover:bg-gray-50 rounded-l-lg"
                  aria-label="-"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{hotelCustomerRooms}</span>
                <button
                  type="button"
                  onClick={() => onHotelRoomsChange(hotelCustomerRooms + 1)}
                  className="inline-flex h-9 w-9 items-center justify-center text-gray-600 hover:bg-gray-50 rounded-r-lg"
                  aria-label="+"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {labels.guideRoomIncluded}
              {' · '}
              {labels.totalRooms}
            </p>
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
          {labels.addonGroup}
        </div>
        <div className="flex flex-wrap gap-2">
          {addons.map((addon) => (
            <button
              key={addon.id}
              type="button"
              title={labels.addonFeeContextHint}
              aria-pressed={addon.selected}
              onClick={() => onToggleAddon(addon.id)}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setAddonFeeEditor({ addon, x: event.clientX, y: event.clientY })
              }}
              className={chipClass(addon.selected)}
            >
              {addonIcon(addon.id, addon.selected)}
              <span className="text-left leading-snug">{addon.label}</span>
              <span className={`text-xs font-medium ${addon.selected ? 'opacity-90' : 'text-muted-foreground'}`}>
                ${addon.rate}
              </span>
            </button>
          ))}
        </div>
        {addons.some((addon) => addon.selected) ? (
          <div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
            {addons.filter((addon) => addon.selected).map((addon) => (
              <div key={addon.id} className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-700 min-w-0 flex-1">{addon.label}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{addon.qtyLabel}</span>
                <div className="inline-flex items-center rounded-lg border border-border bg-white">
                  <button
                    type="button"
                    onClick={() => onAddonQtyChange(addon.id, Math.max(1, addon.qty - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center text-gray-600 hover:bg-gray-50 rounded-l-lg"
                    aria-label="-"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{addon.qty}</span>
                  <button
                    type="button"
                    onClick={() => onAddonQtyChange(addon.id, addon.qty + 1)}
                    className="inline-flex h-9 w-9 items-center justify-center text-gray-600 hover:bg-gray-50 rounded-r-lg"
                    aria-label="+"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ${addon.rate} × {addon.qty} = ${addon.rate * addon.qty}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <div className="text-center text-gray-500 py-6 text-sm">{emptyLabel}</div>
      ) : (
        groups.map((group) => {
          const groupName = group.id === '__standalone__'
            ? standaloneGroupLabel
            : locale === 'en'
              ? group.nameEn || group.nameKo
              : group.nameKo || group.nameEn
          const showHeader = groups.length > 1 || group.id !== '__standalone__'

          return (
            <div key={group.id}>
              {showHeader && groupName ? (
                <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
                  {groupName}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {group.courses.map((course) => {
                  const selected = selectedCourses.has(course.id)
                  const priceHint = coursePriceHint(course)
                  const label = courseLabel(course, locale)

                  return (
                    <button
                      key={course.id}
                      type="button"
                      title={labels.feeContextHint}
                      onClick={() => (selected ? onDeselect(course.id) : onSelect(course.id))}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setFeeEditor({ course, x: event.clientX, y: event.clientY })
                      }}
                      aria-pressed={selected}
                      className={chipClass(selected)}
                    >
                      <MapPin className={`h-4 w-4 flex-shrink-0 ${selected ? 'opacity-90' : 'text-muted-foreground'}`} />
                      <span className="text-left leading-snug">{label}</span>
                      {priceHint ? (
                        <span className={`text-xs font-medium ${selected ? 'opacity-90' : 'text-muted-foreground'}`}>
                          {priceHint}
                        </span>
                      ) : (
                        <span className={`text-xs ${selected ? 'opacity-80' : 'text-muted-foreground'}`}>$—</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
      {feeEditor ? (
        <QuickEntranceFeePopover
          courseName={courseLabel(feeEditor.course, locale)}
          initialPrice={
            feeEditor.course.price_type === 'per_vehicle'
              ? null
              : feeEditor.course.price_adult ?? null
          }
          x={feeEditor.x}
          y={feeEditor.y}
          saving={feeSaving}
          labels={{
            title: labels.feeTitle,
            perPerson: labels.feePerPerson,
            save: labels.feeSave,
            cancel: labels.feeCancel,
            clear: labels.feeClear,
          }}
          onSave={(price) => {
            onSaveEntranceFee(feeEditor.course.id, price)
            setFeeEditor(null)
          }}
          onClose={() => setFeeEditor(null)}
        />
      ) : null}
      {addonFeeEditor ? (
        <QuickEntranceFeePopover
          courseName={addonFeeEditor.addon.label}
          initialPrice={addonFeeEditor.addon.rate}
          x={addonFeeEditor.x}
          y={addonFeeEditor.y}
          labels={{
            title: labels.feeTitle,
            perPerson: labels.feePerPerson,
            save: labels.feeSave,
            cancel: labels.feeCancel,
            clear: labels.feeClear,
          }}
          onSave={(price) => {
            onSaveAddonRate(addonFeeEditor.addon.id, price)
            setAddonFeeEditor(null)
          }}
          onClose={() => setAddonFeeEditor(null)}
        />
      ) : null}
    </>
  )
}
