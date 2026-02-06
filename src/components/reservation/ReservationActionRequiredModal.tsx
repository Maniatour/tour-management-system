'use client'

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { X, AlertCircle, MapPin, DollarSign, CreditCard, Scale } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { ReservationCardItem } from '@/components/reservation/ReservationCardItem'
import { calculateTotalPrice } from '@/utils/reservationUtils'
import type { Reservation, Customer } from '@/types/reservation'

export type ActionRequiredTabId = 'status' | 'tour' | 'pricing' | 'deposit' | 'balance'

interface ReservationActionRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  reservations: Reservation[]
  customers: Customer[]
  products: Array<{ id: string; name: string; sub_category?: string; base_price?: number }>
  channels: Array<{ id: string; name: string; favicon_url?: string | null }>
  pickupHotels: Array<{ id: string; hotel?: string | null; name?: string | null; name_ko?: string | null; pick_up_location?: string | null; address?: string | null }>
  productOptions: Array<{ id: string; name: string; is_required?: boolean }>
  optionChoices: Array<{ id: string; name: string; option_id?: string; adult_price?: number; child_price?: number; infant_price?: number }>
  tourInfoMap: Map<string, {
    totalPeople: number
    otherReservationsTotalPeople: number
    allDateTotalPeople: number
    status: string
    guideName: string
    assistantName: string
    vehicleName: string
    tourDate: string
    tourStartDatetime: string | null
    isAssigned: boolean
    reservationIds: string[]
    productId: string | null
  }>
  reservationPricingMap: Map<string, {
    total_price: number
    balance_amount: number
    adult_product_price?: number
    child_product_price?: number
    infant_product_price?: number
    product_price_total?: number
    coupon_discount?: number
    additional_discount?: number
    additional_cost?: number
    commission_percent?: number
    commission_amount?: number
    currency?: string
  }>
  locale: string
  onPricingInfoClick: (reservation: Reservation) => void
  onCreateTour: (reservation: Reservation) => void
  onPickupTimeClick: (reservation: Reservation, e: React.MouseEvent) => void
  onPickupHotelClick: (reservation: Reservation, e: React.MouseEvent) => void
  onPaymentClick: (reservation: Reservation) => void
  onDetailClick: (reservation: Reservation) => void
  onReviewClick: (reservation: Reservation) => void
  onEmailPreview: (reservation: Reservation, emailType: 'confirmation' | 'departure' | 'pickup') => void
  onEmailLogsClick: (reservationId: string) => void
  onEmailDropdownToggle: (reservationId: string) => void
  onEditClick: (reservationId: string) => void
  onCustomerClick: (customer: Customer) => void
  onRefreshReservations: () => void
  generatePriceCalculation: (reservation: Reservation, pricing: unknown) => string
  getGroupColorClasses: (groupId: string, groupName?: string, optionName?: string) => string
  getSelectedChoicesFromNewSystem: (reservationId: string) => Promise<Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: { option_key: string; option_name: string; option_name_ko: string; product_choices: { choice_group_ko: string } }
  }>>
  choicesCacheRef: React.MutableRefObject<Map<string, Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: { option_key: string; option_name: string; option_name_ko: string; product_choices: { choice_group_ko: string } }
  }>>>
  emailDropdownOpen: string | null
  sendingEmail: string | null
}

const TABS: { id: ActionRequiredTabId; labelKey: string; icon: React.ElementType }[] = [
  { id: 'status', labelKey: 'actionRequired.tabs.status', icon: AlertCircle },
  { id: 'tour', labelKey: 'actionRequired.tabs.tour', icon: MapPin },
  { id: 'pricing', labelKey: 'actionRequired.tabs.pricing', icon: DollarSign },
  { id: 'deposit', labelKey: 'actionRequired.tabs.deposit', icon: CreditCard },
  { id: 'balance', labelKey: 'actionRequired.tabs.balance', icon: Scale }
]

export default function ReservationActionRequiredModal({
  isOpen,
  onClose,
  reservations,
  customers,
  products,
  channels,
  pickupHotels,
  productOptions,
  optionChoices,
  tourInfoMap,
  reservationPricingMap,
  locale,
  onPricingInfoClick,
  onCreateTour,
  onPickupTimeClick,
  onPickupHotelClick,
  onPaymentClick,
  onDetailClick,
  onReviewClick,
  onEmailPreview,
  onEmailLogsClick,
  onEmailDropdownToggle,
  onEditClick,
  onCustomerClick,
  onRefreshReservations,
  generatePriceCalculation,
  getGroupColorClasses,
  getSelectedChoicesFromNewSystem,
  choicesCacheRef,
  emailDropdownOpen,
  sendingEmail
}: ReservationActionRequiredModalProps) {
  const t = useTranslations('reservations')
  const [activeTab, setActiveTab] = useState<ActionRequiredTabId>('status')
  const [reservationIdsWithPayments, setReservationIdsWithPayments] = useState<Set<string>>(new Set())
  const [loadingPayments, setLoadingPayments] = useState(false)

  const todayStr = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  }, [])

  const sevenDaysLaterStr = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }, [])

  useEffect(() => {
    if (!isOpen || reservations.length === 0) {
      setReservationIdsWithPayments(new Set())
      return
    }
    const ids = reservations.map(r => r.id)
    setLoadingPayments(true)
    const load = async () => {
      const set = new Set<string>()
      const chunkSize = 200
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const { data } = await supabase
          .from('payment_records')
          .select('reservation_id')
          .in('reservation_id', chunk)
        if (data) {
          data.forEach((row: { reservation_id: string }) => set.add(row.reservation_id))
        }
      }
      setReservationIdsWithPayments(set)
      setLoadingPayments(false)
    }
    load()
  }, [isOpen, reservations])

  const hasTourAssigned = useCallback((r: Reservation) => {
    const id = r.tourId?.trim?.()
    return !!(id && id !== '' && id !== 'null' && id !== 'undefined')
  }, [])

  const filteredByTab = useMemo(() => {
    const statusPending = (r: Reservation) => (r.status === 'pending' || (r.status as string)?.toLowerCase?.() === 'pending')
    const statusConfirmed = (r: Reservation) => (r.status === 'confirmed' || (r.status as string)?.toLowerCase?.() === 'confirmed')
    const hasPayment = (r: Reservation) => reservationIdsWithPayments.has(r.id)
    const hasPricing = (r: Reservation) => {
      const p = reservationPricingMap.get(r.id)
      return !!(p && (p.total_price != null && p.total_price > 0))
    }
    const storedTotalMatchesDynamic = (r: Reservation) => {
      const stored = reservationPricingMap.get(r.id)?.total_price
      if (stored == null) return true
      const calculated = calculateTotalPrice(r, products, optionChoices)
      return Math.abs((stored ?? 0) - calculated) <= 0.01
    }
    const getBalance = (r: Reservation) => {
      const p = reservationPricingMap.get(r.id)
      const b = p?.balance_amount
      if (b == null) return 0
      return typeof b === 'number' ? b : parseFloat(String(b)) || 0
    }
    const tourDateBeforeToday = (r: Reservation) => {
      const d = r.tourDate
      if (!d) return false
      return d < todayStr
    }
    const tourDateWithin7Days = (r: Reservation) => {
      const d = r.tourDate
      if (!d) return false
      return d >= todayStr && d <= sevenDaysLaterStr
    }

    const statusList = reservations.filter(r =>
      tourDateWithin7Days(r) && statusPending(r)
    )
    const tourList = reservations.filter(r =>
      statusConfirmed(r) && !hasTourAssigned(r)
    )
    const noPricing = reservations.filter(r => !hasPricing(r))
    const pricingMismatch = reservations.filter(r =>
      hasPricing(r) && !storedTotalMatchesDynamic(r)
    )
    const pricingList = [...new Map([...noPricing.map(r => [r.id, r]), ...pricingMismatch.map(r => [r.id, r])]).values()]
    const depositNoTour = reservations.filter(r => hasPayment(r) && !hasTourAssigned(r))
    const confirmedNoDeposit = reservations.filter(r => statusConfirmed(r) && !hasPayment(r))
    const depositList = [...new Map([...depositNoTour.map(r => [r.id, r]), ...confirmedNoDeposit.map(r => [r.id, r])]).values()]
    const balanceList = reservations.filter(r => tourDateBeforeToday(r) && getBalance(r) > 0)

    return {
      status: statusList,
      tour: tourList,
      pricing: pricingList,
      deposit: depositList,
      balance: balanceList
    }
  }, [
    reservations,
    reservationPricingMap,
    products,
    optionChoices,
    reservationIdsWithPayments,
    todayStr,
    sevenDaysLaterStr,
    hasTourAssigned
  ])

  const counts = useMemo(() => ({
    status: filteredByTab.status.length,
    tour: filteredByTab.tour.length,
    pricing: filteredByTab.pricing.length,
    deposit: filteredByTab.deposit.length,
    balance: filteredByTab.balance.length
  }), [filteredByTab])

  const totalActionCount = useMemo(() =>
    new Set([
      ...filteredByTab.status.map(r => r.id),
      ...filteredByTab.tour.map(r => r.id),
      ...filteredByTab.pricing.map(r => r.id),
      ...filteredByTab.deposit.map(r => r.id),
      ...filteredByTab.balance.map(r => r.id)
    ]).size
  , [filteredByTab])

  const currentList = filteredByTab[activeTab]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('actionRequired.title')}
            {totalActionCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                {totalActionCount}건
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 overflow-x-auto flex-shrink-0">
          {TABS.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{t(labelKey)}</span>
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs ${
                counts[id] > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loadingPayments && (activeTab === 'deposit') ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
              <span className="ml-2 text-sm text-gray-600">입금 데이터 조회 중...</span>
            </div>
          ) : currentList.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {t('actionRequired.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentList.map((reservation) => (
                <ReservationCardItem
                  key={reservation.id}
                  reservation={reservation}
                  customers={customers}
                  products={products}
                  channels={channels}
                  pickupHotels={pickupHotels}
                  productOptions={productOptions}
                  optionChoices={optionChoices}
                  tourInfoMap={tourInfoMap}
                  reservationPricingMap={reservationPricingMap}
                  locale={locale}
                  emailDropdownOpen={emailDropdownOpen}
                  sendingEmail={sendingEmail}
                  onPricingInfoClick={onPricingInfoClick}
                  onCreateTour={onCreateTour}
                  onPickupTimeClick={onPickupTimeClick}
                  onPickupHotelClick={onPickupHotelClick}
                  onPaymentClick={onPaymentClick}
                  onDetailClick={onDetailClick}
                  onReviewClick={onReviewClick}
                  onEmailPreview={onEmailPreview}
                  onEmailLogsClick={onEmailLogsClick}
                  onEmailDropdownToggle={onEmailDropdownToggle}
                  onEditClick={onEditClick}
                  onCustomerClick={onCustomerClick}
                  onRefreshReservations={onRefreshReservations}
                  generatePriceCalculation={generatePriceCalculation}
                  getGroupColorClasses={getGroupColorClasses}
                  getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
                  choicesCacheRef={choicesCacheRef}
                  showResidentStatusIcon={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
