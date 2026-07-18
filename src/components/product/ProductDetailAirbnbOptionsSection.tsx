'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, ImageOff, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'
import ProductDetailQuantityChoiceGroup from '@/components/product/ProductDetailQuantityChoiceGroup'
import { usesCapacityQuantitySelection } from '@/lib/choiceOptionCapacity'

type ProductDetailAirbnbOptionsSectionProps = {
  groupedChoices: Record<string, ProductDetailChoiceGroup>
  selectedOptions: Record<string, string>
  selectedChoiceQuantities?: Record<string, Record<string, number>>
  partySize?: number
  /** 상품 초이스 표시 방식: list(리스트) | card(사진 카드뷰) */
  displayMode?: 'list' | 'card'
  onOptionChange: (choiceId: string, optionId: string) => void
  onQuantityChange?: (choiceId: string, optionId: string, quantity: number) => void
  onCompareOptions: () => void
  onBookNow: () => void
  totalPrice: number
  displayTotalPrice: number
  promoDiscountAmount: number
  appliedPromoCode?: string | null
  selectedDate: string
  isEnglish: boolean
  bookDisabled?: boolean
}

type ChoiceGroupOption = ProductDetailChoiceGroup['options'][number]

function ChoiceOptionDescription({ description }: { description: string }) {
  const t = useTranslations('productDetail')
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [needsToggle, setNeedsToggle] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [description])

  useEffect(() => {
    if (!description || expanded) return
    const el = descriptionRef.current
    if (!el) return
    setNeedsToggle(el.scrollHeight > el.clientHeight + 1)
  }, [description, expanded])

  return (
    <div className="mt-2 sm:mt-0.5">
      <p
        ref={descriptionRef}
        className={`text-xs leading-5 text-[#6b7280] sm:text-sm sm:leading-6 ${
          expanded ? '' : 'line-clamp-2'
        }`}
      >
        {description}
      </p>
      {(needsToggle || expanded) && (
        <button
          type="button"
          className="mt-1 min-h-11 text-xs font-semibold text-[#1a2b49] underline underline-offset-2 sm:min-h-0"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setExpanded((prev) => !prev)
          }}
        >
          {expanded ? t('choiceDescriptionShowLess') : t('choiceDescriptionShowMore')}
        </button>
      )}
    </div>
  )
}

function ChoiceOptionCard({
  option,
  optionLabel,
  selected,
  isEnglish,
  onSelect,
}: {
  option: ChoiceGroupOption
  optionLabel: string
  selected: boolean
  isEnglish: boolean
  onSelect: () => void
}) {
  const imageUrl = option.option_thumbnail_url || option.option_image_url || null
  const description = (
    isEnglish
      ? option.option_description || option.option_description_ko
      : option.option_description_ko || option.option_description
  )?.trim()
  const priceLabel =
    option.option_price && option.option_price > 0 ? `+$${option.option_price}` : ''

  const selectionDot = (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        selected
          ? 'border-[#1a2b49] bg-[#1a2b49] text-white'
          : 'border-[#d1d5db] bg-white text-transparent'
      }`}
      aria-hidden
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  )

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={`group w-full cursor-pointer overflow-hidden rounded-2xl border text-left transition-all duration-300 ${
        selected
          ? 'border-[#1a2b49] ring-2 ring-[#1a2b49] shadow-md'
          : 'border-[#e5e7eb] hover:border-[#1a2b49]/40 hover:shadow-md'
      }`}
    >
      {/* 모바일: 상단 제목·가격 + 전체 너비 사진 + 설명 */}
      <div className="flex flex-col sm:hidden">
        <div className="flex items-start gap-3 px-3.5 pt-3.5">
          <span className="mt-0.5">{selectionDot}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[15px] font-semibold leading-snug text-[#1a2b49]">
                {optionLabel}
              </span>
              {priceLabel ? (
                <span className="shrink-0 text-[15px] font-semibold text-[#1a2b49]">
                  {priceLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative mx-3.5 mt-3 aspect-[16/10] overflow-hidden rounded-xl bg-[#f3f4f6]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={optionLabel}
              fill
              sizes="(max-width: 640px) 100vw, 400px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#9ca3af]">
              <ImageOff className="h-8 w-8" aria-hidden />
            </span>
          )}
        </div>

        {description ? (
          <div className="px-3.5 pb-3.5 pt-1">
            <ChoiceOptionDescription description={description} />
          </div>
        ) : (
          <div className="pb-3.5" />
        )}
      </div>

      {/* 데스크톱: 선택 · 사진 · 텍스트 가로형 */}
      <div className="hidden items-stretch sm:flex">
        <span className="flex shrink-0 items-center pl-4">{selectionDot}</span>

        <span className="relative ml-4 my-3 h-[104px] w-[140px] shrink-0 self-center overflow-hidden rounded-xl bg-[#f3f4f6]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={optionLabel}
              fill
              sizes="140px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#9ca3af]">
              <ImageOff className="h-7 w-7" aria-hidden />
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-[#1a2b49]">{optionLabel}</span>
            {description ? <ChoiceOptionDescription description={description} /> : null}
          </span>
          {priceLabel ? (
            <span className="shrink-0 self-center text-base font-semibold text-[#1a2b49]">
              {priceLabel}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  )
}

export default function ProductDetailAirbnbOptionsSection({
  groupedChoices,
  selectedOptions,
  selectedChoiceQuantities = {},
  partySize = 0,
  displayMode = 'list',
  onOptionChange,
  onQuantityChange,
  onCompareOptions,
  onBookNow,
  totalPrice,
  displayTotalPrice,
  promoDiscountAmount,
  appliedPromoCode,
  selectedDate,
  isEnglish,
  bookDisabled = false,
}: ProductDetailAirbnbOptionsSectionProps) {
  const t = useTranslations('productDetail')
  const groups = Object.values(groupedChoices)
  const hasPromo = promoDiscountAmount > 0

  if (groups.length === 0 || !selectedDate) {
    return null
  }

  return (
    <section className="airbnb-detail-section airbnb-detail-options airbnb-detail-options-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="airbnb-detail-section-title mb-0">{t('bookingOptionsTitle')}</h2>
        <button
          type="button"
          onClick={onCompareOptions}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a2b49] underline underline-offset-2"
        >
          <Info className="h-4 w-4" aria-hidden />
          {t('compareOptions')}
        </button>
      </div>

      {groups.map((group) => {
        const isQuantityCapacity = usesCapacityQuantitySelection(group.choice_type, group.options)

        return (
          <div key={group.choice_id} className="mb-6 last:mb-0">
            <h3 className="mb-3 text-base font-semibold text-[#1a2b49]">
              {isEnglish
                ? group.choice_name || group.choice_name_ko
                : group.choice_name_ko || group.choice_name}
            </h3>
            {isQuantityCapacity && onQuantityChange ? (
              group.options.length === 0 ? (
                <p className="text-sm text-[#6b7280]">{t('noRoomsForPartySize')}</p>
              ) : (
                <ProductDetailQuantityChoiceGroup
                  group={group}
                  quantities={selectedChoiceQuantities[group.choice_id] ?? {}}
                  partySize={partySize}
                  isEnglish={isEnglish}
                  onQuantityChange={(optionId, quantity) =>
                    onQuantityChange(group.choice_id, optionId, quantity)
                  }
                />
              )
            ) : displayMode === 'card' ? (
              <div className="space-y-3" role="radiogroup">
                {group.options.map((option) => {
                  const selected = selectedOptions[group.choice_id] === option.option_id
                  const optionLabel =
                    (isEnglish
                      ? option.option_name || option.option_name_ko
                      : option.option_name_ko || option.option_name) || ''
                  return (
                    <ChoiceOptionCard
                      key={option.option_id}
                      option={option}
                      optionLabel={optionLabel}
                      selected={selected}
                      isEnglish={isEnglish}
                      onSelect={() => onOptionChange(group.choice_id, option.option_id)}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3" role="radiogroup">
                {group.options.map((option) => {
                  const selected = selectedOptions[group.choice_id] === option.option_id
                  const optionLabel = isEnglish
                    ? option.option_name || option.option_name_ko
                    : option.option_name_ko || option.option_name
                  return (
                    <button
                      key={option.option_id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onOptionChange(group.choice_id, option.option_id)}
                      className={`airbnb-detail-option-card ${selected ? 'is-selected' : ''}`}
                    >
                      <span className="airbnb-detail-option-radio" aria-hidden>
                        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-sm font-semibold text-[#1a2b49] sm:text-base">
                          {optionLabel}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-[#1a2b49] sm:text-base">
                        {option.option_price && option.option_price > 0
                          ? `+$${option.option_price}`
                          : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div className="airbnb-detail-options-summary">
        <div>
          {hasPromo ? (
            <p className="text-sm text-[#9ca3af] line-through">${totalPrice}</p>
          ) : null}
          <p className="text-2xl font-bold text-[#1a2b49]">
            ${hasPromo ? displayTotalPrice.toFixed(2) : totalPrice}
            <span className="text-sm font-normal text-[#6b7280]"> {t('perPerson')}</span>
          </p>
          {hasPromo ? (
            <p className="mt-0.5 text-xs font-medium text-[#059669]">
              {t('promoDiscountLabel')}
              {appliedPromoCode ? ` (${appliedPromoCode})` : ''}: -${promoDiscountAmount.toFixed(2)}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[#6b7280]">{t('freeCancellationNote')}</p>
          )}
          {bookDisabled ? (
            <p className="mt-1 text-xs font-medium text-amber-700">{t('capacitySelectToMatch')}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onBookNow}
          disabled={bookDisabled}
          className="airbnb-detail-reserve-btn sm:max-w-[220px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('bookNow')}
        </button>
      </div>
    </section>
  )
}
