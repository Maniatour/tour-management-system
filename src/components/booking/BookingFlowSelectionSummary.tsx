'use client'

import { useEffect, useState } from 'react'
import { Calendar, ChevronRight, Minus, Plus, Ticket, Users, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import ProductDetailBookingCalendar from '@/components/product/ProductDetailBookingCalendar'
import { useBookingFlowPickupDisplay } from '@/hooks/useBookingFlowPickupDisplay'
import {
  clampTravelerCounts,
  DEFAULT_TRAVELER_AGE_LIMITS,
  getTravelerTotal,
  type TravelerAgeLimits,
  type TravelerCounts,
} from '@/lib/productDetailTravelers'

type ChoiceOptionSummary = {
  option_id: string
  option_name?: string | null
  option_name_ko?: string | null
  option_name_en?: string | null
}

type ChoiceGroupSummary = {
  choice_id: string
  choice_name?: string | null
  choice_name_ko?: string | null
  choice_name_en?: string | null
  choice_type?: string | null
  options: ChoiceOptionSummary[]
}

type BookingFlowSelectionSummaryProps = {
  isEnglish: boolean
  translate: (ko: string, en: string) => string
  productId: string
  productDisplayName: string
  product: {
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
    adult_age?: number | null
    child_age_min?: number | null
    child_age_max?: number | null
    infant_age?: number | null
    max_participants?: number | null
  }
  selectedDate: string | null
  onDateChange: (date: string) => void
  participants: TravelerCounts
  onParticipantsChange: (counts: TravelerCounts) => void
  requiredChoices: ChoiceGroupSummary[]
  selectedOptions: Record<string, string>
  selectedChoiceQuantities: Record<string, Record<string, number>>
  renderChoiceGroupEditor: (choiceId: string) => React.ReactNode
  departureTime?: string | null
}

function formatDateLabel(iso: string, locale: string): string {
  if (!iso) return ''
  const date = new Date(`${iso}T12:00:00`)
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatParticipantsSummary(
  counts: TravelerCounts,
  translate: (ko: string, en: string) => string
): string {
  const parts: string[] = []
  if (counts.adults > 0) {
    parts.push(
      translate(`${counts.adults}명 성인`, `${counts.adults} adult${counts.adults > 1 ? 's' : ''}`)
    )
  }
  if (counts.children > 0) {
    parts.push(
      translate(`${counts.children}명 아동`, `${counts.children} child${counts.children > 1 ? 'ren' : ''}`)
    )
  }
  if (counts.infants > 0) {
    parts.push(
      translate(`${counts.infants}명 유아`, `${counts.infants} infant${counts.infants > 1 ? 's' : ''}`)
    )
  }
  return parts.join(', ')
}

function getChoiceSummaryLabel(
  group: ChoiceGroupSummary,
  selectedOptions: Record<string, string>,
  selectedChoiceQuantities: Record<string, Record<string, number>>,
  isEnglish: boolean,
  translate: (ko: string, en: string) => string
): string {
  const selectedId = selectedOptions[group.choice_id]
  if (!selectedId) return translate('선택 안 됨', 'Not selected')

  const option = group.options.find((item) => item.option_id === selectedId)
  if (!option) return translate('선택 안 됨', 'Not selected')

  const label = isEnglish
    ? option.option_name_en || option.option_name || option.option_name_ko || ''
    : option.option_name_ko || option.option_name || option.option_name_en || ''

  if (group.choice_type === 'quantity') {
    const quantity = selectedChoiceQuantities[group.choice_id]?.[selectedId] || 0
    if (quantity > 0) {
      return `${label} × ${quantity}`
    }
  }

  return label || translate('선택 안 됨', 'Not selected')
}

function getChoiceGroupSummaryLabel(group: ChoiceGroupSummary, isEnglish: boolean): string {
  return isEnglish
    ? group.choice_name_en || group.choice_name || group.choice_name_ko || ''
    : group.choice_name_ko || group.choice_name || group.choice_name_en || ''
}

type SummaryRowProps = {
  label: string
  value: string
  secondaryValue?: React.ReactNode
  onEdit: () => void
  editLabel: string
  icon: React.ReactNode
}

function SummaryRow({ label, value, secondaryValue, onEdit, editLabel, icon }: SummaryRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
        {secondaryValue ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{secondaryValue}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary hover:text-primary/80"
      >
        {editLabel}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

type EditModalProps = {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}

function EditModal({ title, onClose, children, wide = false }: EditModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
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
    <div className="flex items-center justify-between gap-4 border-b border-border/40 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {badge ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{ageRange}</p>
        <p className="text-xs text-muted-foreground/80">{t('travelerMinMax', { min, max })}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-40"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          aria-label={`${label} decrease`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-5 text-center text-base font-semibold">{value}</span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-40"
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

export default function BookingFlowSelectionSummary({
  isEnglish,
  translate,
  productId,
  productDisplayName,
  product,
  selectedDate,
  onDateChange,
  participants,
  onParticipantsChange,
  requiredChoices,
  selectedOptions,
  selectedChoiceQuantities,
  renderChoiceGroupEditor,
  departureTime,
}: BookingFlowSelectionSummaryProps) {
  const locale = useLocale()
  const t = useTranslations('productDetail')

  const { pickupDisplay, loading: loadingPickup } = useBookingFlowPickupDisplay(
    productId,
    selectedDate,
    product,
    isEnglish,
    departureTime
  )

  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [travelersModalOpen, setTravelersModalOpen] = useState(false)
  const [editingChoiceId, setEditingChoiceId] = useState<string | null>(null)
  const [draftCounts, setDraftCounts] = useState<TravelerCounts>(participants)

  const ageLimits: TravelerAgeLimits = {
    adultAge: product.adult_age ?? DEFAULT_TRAVELER_AGE_LIMITS.adultAge,
    childAgeMin: product.child_age_min ?? DEFAULT_TRAVELER_AGE_LIMITS.childAgeMin,
    childAgeMax: product.child_age_max ?? DEFAULT_TRAVELER_AGE_LIMITS.childAgeMax,
    infantAge: product.infant_age ?? DEFAULT_TRAVELER_AGE_LIMITS.infantAge,
    maxParticipants: product.max_participants ?? DEFAULT_TRAVELER_AGE_LIMITS.maxParticipants,
  }

  useEffect(() => {
    if (travelersModalOpen) {
      setDraftCounts(participants)
    }
  }, [travelersModalOpen, participants])

  const editLabel = translate('변경', 'Change')
  const participantsSummary =
    formatParticipantsSummary(participants, translate) ||
    translate(`${getTravelerTotal(participants)}명`, `${getTravelerTotal(participants)} guest${getTravelerTotal(participants) > 1 ? 's' : ''}`)

  const handleDateSelect = (date: string) => {
    onDateChange(date)
    setDateModalOpen(false)
  }

  const applyTravelers = () => {
    onParticipantsChange(clampTravelerCounts(draftCounts, ageLimits))
    setTravelersModalOpen(false)
  }

  const updateDraft = (key: keyof TravelerCounts, value: number) => {
    setDraftCounts((prev) => clampTravelerCounts({ ...prev, [key]: value }, ageLimits))
  }

  const editingGroup = requiredChoices.find((group) => group.choice_id === editingChoiceId)

  return (
    <>
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            {translate('예약 확인', 'Your Selection')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {translate(
              '선택하신 내용을 확인하세요. 변경하려면 각 항목의 변경 버튼을 눌러주세요.',
              'Review your selections below. Tap Change on any item to update it.'
            )}
          </p>
        </div>

        <div className="space-y-3">
          <SummaryRow
            label={t('dateLabel')}
            value={
              selectedDate
                ? formatDateLabel(selectedDate, locale)
                : translate('날짜를 선택해주세요', 'Select a date')
            }
            secondaryValue={
              selectedDate && loadingPickup
                ? t('sunriseScheduleLoading')
                : selectedDate && pickupDisplay
                  ? `${t('sunrisePickupWindowLabel')}: ${pickupDisplay}`
                  : undefined
            }
            onEdit={() => setDateModalOpen(true)}
            editLabel={editLabel}
            icon={<Calendar className="h-5 w-5" aria-hidden />}
          />

          <SummaryRow
            label={t('travelersLabel')}
            value={participantsSummary}
            onEdit={() => setTravelersModalOpen(true)}
            editLabel={editLabel}
            icon={<Users className="h-5 w-5" aria-hidden />}
          />
        </div>

        {requiredChoices.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {translate('필수 선택', 'Required Options')}
            </h4>
            {requiredChoices.map((group) => {
              const groupName = getChoiceGroupSummaryLabel(group, isEnglish)

              return (
                <SummaryRow
                  key={group.choice_id}
                  label={groupName}
                  value={getChoiceSummaryLabel(
                    group,
                    selectedOptions,
                    selectedChoiceQuantities,
                    isEnglish,
                    translate
                  )}
                  onEdit={() => setEditingChoiceId(group.choice_id)}
                  editLabel={editLabel}
                  icon={<Ticket className="h-5 w-5" aria-hidden />}
                />
              )
            })}
          </div>
        ) : null}
      </div>

      {dateModalOpen ? (
        <EditModal title={t('dateLabel')} onClose={() => setDateModalOpen(false)} wide>
          <ProductDetailBookingCalendar
            productId={productId}
            selectedDate={selectedDate || ''}
            onDateChange={handleDateSelect}
            onClose={() => setDateModalOpen(false)}
            customerTourName={productDisplayName}
            product={product}
          />
        </EditModal>
      ) : null}

      {travelersModalOpen ? (
        <EditModal title={t('travelersLabel')} onClose={() => setTravelersModalOpen(false)}>
          <p className="mb-2 text-sm text-muted-foreground">
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
          <button
            type="button"
            onClick={applyTravelers}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t('applyTravelers')}
          </button>
        </EditModal>
      ) : null}

      {editingChoiceId && editingGroup ? (
        <EditModal
          wide
          title={
            isEnglish
              ? editingGroup.choice_name_en || editingGroup.choice_name || editingGroup.choice_name_ko || translate('필수 선택', 'Required Options')
              : editingGroup.choice_name_ko || editingGroup.choice_name || editingGroup.choice_name_en || translate('필수 선택', 'Required Options')
          }
          onClose={() => setEditingChoiceId(null)}
        >
          {renderChoiceGroupEditor(editingChoiceId)}
          <button
            type="button"
            onClick={() => setEditingChoiceId(null)}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {translate('확인', 'Done')}
          </button>
        </EditModal>
      ) : null}
    </>
  )
}
