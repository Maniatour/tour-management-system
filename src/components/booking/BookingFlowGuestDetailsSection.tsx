'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Hotel, Loader2, MessageCircle, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { buildLegalPageHref } from '@/lib/customerSiteRoutes'
import {
  BOOKING_LOCAL_CONTACT_CHANNELS,
} from '@/lib/bookingFlowGuestNotes'
import {
  type CustomerCommunicationChannel,
  renderCustomerCommunicationChannelIcon,
} from '@/lib/customerCommunicationChannel'
import BookingFlowAlternativeDateFields from '@/components/booking/BookingFlowAlternativeDateFields'
import {
  fetchCustomerPickupHotels,
  filterCustomerPickupHotels,
  type CustomerPickupHotelLocation,
} from '@/lib/customerPickupHotels'

export type BookingGuestCustomerInfo = {
  name: string
  email: string
  phone: string
  country: string
  customerLanguage: string
  tourLanguages: string[]
  specialRequests: string
  localContactChannel: CustomerCommunicationChannel | ''
  localContactHandle: string
  smsConsent: boolean
}

type CountryOption = {
  code: string
  nameKo: string
  nameEn: string
  phoneCode: string
}

type LanguageOption = {
  code: string
  nameKo: string
  nameEn: string
}

type BookingFlowGuestDetailsSectionProps = {
  isEnglish: boolean
  translate: (ko: string, en: string) => string
  customerInfo: BookingGuestCustomerInfo
  countries: CountryOption[]
  allLanguages: LanguageOption[]
  tourLanguages: LanguageOption[]
  selectedTourDate: string
  productId: string
  pickupHotelId: string
  pickupHotelCustom: string
  alternativeDates: string[]
  onCustomerInfoChange: (patch: Partial<BookingGuestCustomerInfo>) => void
  onPickupHotelIdChange: (hotelId: string, label?: string) => void
  onPickupHotelCustomChange: (value: string) => void
  onAlternativeDatesChange: (dates: string[]) => void
  stripSpacesFromContactInput: (value: string) => string
}

function formatAlternateDateLabel(ymd: string, locale: string): string {
  const date = new Date(`${ymd}T12:00:00`)
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function getBookingChannelLabel(
  channel: CustomerCommunicationChannel,
  isEnglish: boolean,
  tReservation: (key: string) => string
): string {
  if (channel === 'chatroom') {
    return isEnglish ? 'Tour Chat' : '투어 채팅'
  }
  return tReservation(`communicationChannel.${channel}`)
}

export default function BookingFlowGuestDetailsSection({
  isEnglish,
  translate,
  customerInfo,
  countries,
  allLanguages,
  tourLanguages,
  selectedTourDate,
  productId,
  pickupHotelId,
  pickupHotelCustom,
  alternativeDates,
  onCustomerInfoChange,
  onPickupHotelIdChange,
  onPickupHotelCustomChange,
  onAlternativeDatesChange,
  stripSpacesFromContactInput,
}: BookingFlowGuestDetailsSectionProps) {
  const locale = isEnglish ? 'en' : 'ko'
  const tReservation = useTranslations('reservations.card')

  const [pickupHotels, setPickupHotels] = useState<CustomerPickupHotelLocation[]>([])
  const [loadingPickupHotels, setLoadingPickupHotels] = useState(false)
  const [pickupSearch, setPickupSearch] = useState('')
  const [showPickupDropdown, setShowPickupDropdown] = useState(false)
  const [useCustomPickupHotel, setUseCustomPickupHotel] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadHotels = async () => {
      setLoadingPickupHotels(true)
      try {
        const hotels = await fetchCustomerPickupHotels()
        if (!cancelled) setPickupHotels(hotels)
      } catch {
        if (!cancelled) setPickupHotels([])
      } finally {
        if (!cancelled) setLoadingPickupHotels(false)
      }
    }
    void loadHotels()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!pickupHotelId) return
    const matched = pickupHotels.find((hotel) => hotel.id === pickupHotelId)
    if (matched) {
      setPickupSearch(`${matched.hotel}${matched.pick_up_location ? ` · ${matched.pick_up_location}` : ''}`)
      setUseCustomPickupHotel(false)
    }
  }, [pickupHotelId, pickupHotels])

  const filteredPickupHotels = useMemo(
    () => filterCustomerPickupHotels(pickupHotels, pickupSearch),
    [pickupHotels, pickupSearch]
  )

  const selectedChannel = customerInfo.localContactChannel

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {translate('이름 *', 'Name *')}
          </label>
          <input
            type="text"
            value={customerInfo.name}
            onChange={(e) => onCustomerInfoChange({ name: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            placeholder={translate('이름을 입력하세요', 'Enter your name')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {translate('이메일 *', 'Email *')}
          </label>
          <input
            type="email"
            value={customerInfo.email}
            onChange={(e) =>
              onCustomerInfoChange({ email: stripSpacesFromContactInput(e.target.value) })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            placeholder={translate('이메일을 입력하세요', 'Enter your email')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {translate('전화번호 *', 'Phone Number *')}
          </label>
          <div className="flex space-x-2">
            <select
              value={customerInfo.country}
              onChange={(e) => onCustomerInfoChange({ country: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            >
              <option value="">{translate('국가', 'Country')}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.phoneCode} {translate(country.nameKo, country.nameEn)}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={customerInfo.phone}
              onChange={(e) =>
                onCustomerInfoChange({ phone: e.target.value.replace(/[^0-9]/g, '') })
              }
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
              placeholder={translate('전화번호를 입력하세요', 'Enter your phone number')}
            />
          </div>
          {customerInfo.country && customerInfo.phone ? (
            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium">{translate('전체 번호:', 'Full number:')}</span>{' '}
              {countries.find((c) => c.code === customerInfo.country)?.phoneCode}
              {customerInfo.phone}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={customerInfo.smsConsent}
              onChange={(e) => onCustomerInfoChange({ smsConsent: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-ring"
            />
            <span className="text-sm leading-relaxed text-foreground">
              {translate(
                '예약·투어 안내 SMS 수신에 동의합니다.',
                'I agree to receive booking and tour updates via SMS.'
              )}{' '}
              <Link
                href={buildLegalPageHref(locale, 'sms-terms')}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {translate('SMS 이용약관', 'SMS Terms')}
              </Link>
            </span>
          </label>
          <p className="mt-2 pl-7 text-xs text-muted-foreground">
            {translate(
              '픽업 시간, 일정 변경 등 투어 관련 문자를 받을 수 있습니다. 동의하지 않아도 예약은 가능합니다.',
              'You may receive texts about pickup times and schedule changes. You can still complete your booking without opting in.'
            )}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {translate('현지 연락 방법', 'Local Contact Method')}
            </h4>
            <p className="text-xs text-muted-foreground">
              {translate(
                '투어 전후 회사가 연락드릴 수 있는 메신저를 선택해 주세요.',
                'Choose how our team can reach you before or during your trip.'
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BOOKING_LOCAL_CONTACT_CHANNELS.map((channel) => {
            const selected = selectedChannel === channel
            return (
              <button
                key={channel}
                type="button"
                onClick={() =>
                  onCustomerInfoChange({
                    localContactChannel: selected ? '' : channel,
                    ...(selected ? { localContactHandle: '' } : {}),
                  })
                }
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border/60 bg-card text-muted-foreground hover:border-primary/40'
                }`}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                  {renderCustomerCommunicationChannelIcon(channel, 'h-4 w-4')}
                </span>
                <span className="font-medium leading-tight">
                  {getBookingChannelLabel(channel, isEnglish, tReservation)}
                </span>
              </button>
            )
          })}
        </div>

        {selectedChannel ? (
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {translate('연락처 ID / 번호', 'Contact ID / Number')}
            </label>
            <input
              type="text"
              value={customerInfo.localContactHandle}
              onChange={(e) => onCustomerInfoChange({ localContactHandle: e.target.value.trim() })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
              placeholder={translate(
                '카카오톡 ID, 라인 ID, WhatsApp 번호 등',
                'KakaoTalk ID, Line ID, WhatsApp number, etc.'
              )}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Hotel className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {translate('픽업 요청 호텔', 'Requested Pickup Hotel')}
            </h4>
            <p className="text-xs text-muted-foreground">
              {translate(
                '픽업 받으실 호텔을 검색하거나 직접 입력해 주세요.',
                'Search for your pickup hotel or enter it manually.'
              )}
            </p>
          </div>
        </div>

        {!useCustomPickupHotel ? (
          <div className="relative">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={pickupSearch}
                onChange={(e) => {
                  setPickupSearch(e.target.value)
                  setShowPickupDropdown(true)
                  if (!e.target.value.trim()) onPickupHotelIdChange('')
                }}
                onFocus={() => setShowPickupDropdown(true)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 focus:border-transparent focus:ring-2 focus:ring-ring"
                placeholder={translate('호텔명 검색', 'Search hotel name')}
              />
            </div>
            {loadingPickupHotels ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {translate('픽업 호텔 불러오는 중…', 'Loading pickup hotels…')}
              </div>
            ) : null}
            {showPickupDropdown && pickupSearch.trim() && filteredPickupHotels.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border/60 bg-card shadow-md">
                {filteredPickupHotels.slice(0, 8).map((hotel) => (
                  <button
                    key={hotel.id}
                    type="button"
                    onClick={() => {
                      onPickupHotelIdChange(
                        hotel.id,
                        `${hotel.hotel}${hotel.pick_up_location ? ` · ${hotel.pick_up_location}` : ''}`
                      )
                      onPickupHotelCustomChange('')
                      setPickupSearch(
                        `${hotel.hotel}${hotel.pick_up_location ? ` · ${hotel.pick_up_location}` : ''}`
                      )
                      setShowPickupDropdown(false)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                  >
                    <span className="font-medium text-foreground">{hotel.hotel}</span>
                    {hotel.pick_up_location ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {hotel.pick_up_location}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <input
            type="text"
            value={pickupHotelCustom}
            onChange={(e) => {
              onPickupHotelCustomChange(e.target.value)
              onPickupHotelIdChange('')
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
            placeholder={translate('호텔명을 입력하세요', 'Enter your hotel name')}
          />
        )}

        <button
          type="button"
          onClick={() => {
            const next = !useCustomPickupHotel
            setUseCustomPickupHotel(next)
            if (next) {
              onPickupHotelIdChange('')
              setPickupSearch('')
            } else {
              onPickupHotelCustomChange('')
            }
          }}
          className="mt-2 text-sm font-medium text-primary hover:text-primary/80"
        >
          {useCustomPickupHotel
            ? translate('목록에서 호텔 검색하기', 'Search from hotel list')
            : translate('목록에 없는 호텔 직접 입력', 'Enter a hotel not listed')}
        </button>
      </div>

      {selectedTourDate && productId ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <h4 className="text-sm font-semibold text-foreground">
            {translate('다른 가능 출발일 (선택)', 'Other Available Dates (Optional)')}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate(
              `선택하신 ${formatAlternateDateLabel(selectedTourDate, locale)} 외에도 가능한 대체 출발일을 입력하거나, 달력 아이콘으로 여러 날짜를 선택할 수 있습니다.`,
              `If your preferred date is unavailable, enter alternate dates manually or pick multiple dates using the calendar icon.`
            )}
          </p>
          <div className="mt-3">
            <BookingFlowAlternativeDateFields
              productId={productId}
              primaryTourDate={selectedTourDate}
              selectedDates={alternativeDates}
              onSelectedDatesChange={onAlternativeDatesChange}
              translate={translate}
            />
          </div>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {translate('고객의 국가 언어 *', "Customer's Native Language *")}
        </label>
        <select
          value={customerInfo.customerLanguage}
          onChange={(e) => onCustomerInfoChange({ customerLanguage: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
          required
        >
          <option value="">{translate('언어를 선택하세요', 'Select your native language')}</option>
          {allLanguages.map((language) => (
            <option key={language.code} value={language.code}>
              {isEnglish ? language.nameEn : language.nameKo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {translate('선호 투어 언어 (복수 선택 가능)', 'Preferred Tour Languages (multiple selection)')}
        </label>
        <div className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-3 md:grid-cols-3 lg:grid-cols-4">
          {tourLanguages.map((language) => (
            <label
              key={language.code}
              className="flex cursor-pointer items-center space-x-2 rounded p-2 transition-colors hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={customerInfo.tourLanguages.includes(language.code)}
                onChange={(e) => {
                  const newLanguages = e.target.checked
                    ? [...customerInfo.tourLanguages, language.code]
                    : customerInfo.tourLanguages.filter((lang) => lang !== language.code)
                  onCustomerInfoChange({ tourLanguages: newLanguages })
                }}
                className="h-4 w-4 rounded text-primary focus:ring-ring"
              />
              <span className="text-sm text-gray-900">
                {isEnglish ? language.nameEn : language.nameKo}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {translate('특별 요청사항', 'Special Requests')}
        </label>
        <textarea
          value={customerInfo.specialRequests}
          onChange={(e) => onCustomerInfoChange({ specialRequests: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
          placeholder={translate('특별 요청사항이 있다면 입력하세요', 'Let us know if you have any special requests')}
        />
      </div>
    </div>
  )
}
