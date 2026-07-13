'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Minus, Plus, Users, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import ProductDetailBookingCalendar from '@/components/product/ProductDetailBookingCalendar'
import {
  clampTravelerCounts,
  getTravelerTotal,
  type TravelerAgeLimits,
  type TravelerCounts,
} from '@/lib/productDetailTravelers'

type ProductDetailDateTravelersPickersProps = {
  productId: string
  selectedDate: string
  onDateChange: (value: string) => void
  travelerCounts: TravelerCounts
  onTravelerCountsChange: (counts: TravelerCounts) => void
  ageLimits: TravelerAgeLimits
  className?: string
  customerTourName?: string
  product?: {
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  }
}

function formatDateLabel(iso: string, locale: string): string {
  if (!iso) return ''
  const date = new Date(`${iso}T12:00:00`)
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

type TravelerCounterProps = {
  label: string
  ageRange: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  badge?: string
}

function TravelerCounter({
  label,
  ageRange,
  min,
  max,
  value,
  onChange,
  badge,
}: TravelerCounterProps) {
  const t = useTranslations('productDetail')

  return (
    <div className="booking-picker-traveler-row">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[#1a2b49]">{label}</p>
          {badge ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-[#6b7280]">{ageRange}</p>
        <p className="text-xs text-[#9ca3af]">
          {t('travelerMinMax', { min, max })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="booking-picker-counter-btn"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          aria-label={`${label} decrease`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-5 text-center text-base font-semibold text-[#1a2b49]">{value}</span>
        <button
          type="button"
          className="booking-picker-counter-btn"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          aria-label={`${label} increase`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function ProductDetailDateTravelersPickers({
  productId,
  selectedDate,
  onDateChange,
  travelerCounts,
  onTravelerCountsChange,
  ageLimits,
  className = '',
  customerTourName = '',
  product = {},
}: ProductDetailDateTravelersPickersProps) {
  const t = useTranslations('productDetail')
  const locale = useLocale()
  const rootRef = useRef<HTMLDivElement>(null)

  const [dateOpen, setDateOpen] = useState(false)
  const [travelersOpen, setTravelersOpen] = useState(false)
  const [draftCounts, setDraftCounts] = useState<TravelerCounts>(travelerCounts)

  const totalTravelers = getTravelerTotal(travelerCounts)

  useEffect(() => {
    if (travelersOpen) {
      setDraftCounts(travelerCounts)
    }
  }, [travelersOpen, travelerCounts])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setTravelersOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!dateOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDateOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dateOpen])

  const applyTravelers = () => {
    onTravelerCountsChange(clampTravelerCounts(draftCounts, ageLimits))
    setTravelersOpen(false)
  }

  const updateDraft = (key: keyof TravelerCounts, value: number) => {
    setDraftCounts((prev) => clampTravelerCounts({ ...prev, [key]: value }, ageLimits))
  }

  return (
    <div ref={rootRef} className={`booking-picker-root ${className}`.trim()}>
      <div className="booking-picker-fields">
        <div className="relative booking-picker-field-wrap booking-picker-field-wrap-date">
          <button
            type="button"
            className={`booking-picker-field booking-picker-field-date ${dateOpen ? 'is-open' : ''}`}
            onClick={() => {
              setDateOpen((open) => !open)
              setTravelersOpen(false)
            }}
            aria-expanded={dateOpen}
          >
            <span className="booking-picker-field-label">{t('dateLabel')}</span>
            <span className="booking-picker-field-value">
              {selectedDate ? formatDateLabel(selectedDate, locale) : t('selectDatePlaceholder')}
            </span>
            <ChevronDown className="booking-picker-field-chevron" aria-hidden />
          </button>

          {dateOpen && typeof document !== 'undefined'
            ? createPortal(
                <div
                  className="booking-picker-date-modal fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                  onClick={() => setDateOpen(false)}
                  role="presentation"
                >
                  <div
                    className="booking-picker-date-modal-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('dateLabel')}
                  >
                    <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
                      <h3 className="text-lg font-semibold text-foreground">{t('dateLabel')}</h3>
                      <button
                        type="button"
                        onClick={() => setDateOpen(false)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="overflow-y-auto">
                      <ProductDetailBookingCalendar
                        productId={productId}
                        selectedDate={selectedDate}
                        onDateChange={onDateChange}
                        onClose={() => setDateOpen(false)}
                        customerTourName={customerTourName}
                        product={product}
                      />
                    </div>
                  </div>
                </div>,
                document.body
              )
            : null}
        </div>

        <div className="relative booking-picker-field-wrap booking-picker-field-wrap-travelers">
          <button
            type="button"
            className={`booking-picker-field booking-picker-field-travelers ${travelersOpen ? 'is-open' : ''}`}
            onClick={() => {
              setTravelersOpen((open) => !open)
              setDateOpen(false)
            }}
            aria-expanded={travelersOpen}
          >
            <span className="booking-picker-field-label">{t('travelersLabel')}</span>
            <span className="booking-picker-field-value booking-picker-field-travelers-value">
              <Users className="booking-picker-field-travelers-icon" aria-hidden />
              <span className="booking-picker-field-travelers-count">{totalTravelers}</span>
            </span>
            <ChevronDown className="booking-picker-field-chevron" aria-hidden />
          </button>

          {travelersOpen ? (
            <div className="booking-picker-popover booking-picker-travelers-popover">
              <p className="mb-4 text-sm font-medium text-[#374151]">
                {t('travelersSelectHint', { max: ageLimits.maxParticipants })}
              </p>

              <TravelerCounter
                label={t('adultTraveler')}
                ageRange={t('adultAgeValue', { age: ageLimits.adultAge })}
                min={1}
                max={ageLimits.maxParticipants}
                value={draftCounts.adults}
                onChange={(value) => updateDraft('adults', value)}
              />
              <TravelerCounter
                label={t('childTraveler')}
                ageRange={t('childAgeValue', {
                  min: ageLimits.childAgeMin,
                  max: ageLimits.childAgeMax,
                })}
                min={0}
                max={ageLimits.maxParticipants}
                value={draftCounts.children}
                onChange={(value) => updateDraft('children', value)}
              />
              <TravelerCounter
                label={t('infantTraveler')}
                ageRange={t('infantAgeValue', { age: ageLimits.infantAge })}
                min={0}
                max={ageLimits.maxParticipants}
                value={draftCounts.infants}
                onChange={(value) => updateDraft('infants', value)}
                badge={t('infantFreeBadge')}
              />

              <button type="button" onClick={applyTravelers} className="booking-picker-apply-btn">
                {t('applyTravelers')}
              </button>
              <p className="mt-2 text-center text-[11px] text-[#9ca3af]">{t('infantDiscountNote')}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
