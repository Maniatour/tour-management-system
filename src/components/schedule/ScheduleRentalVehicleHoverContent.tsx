'use client'

import { rentalImpliedDailyUsd } from '@/lib/rentalVehicleUtils'
import { formatRentalTimeDisplay } from '@/lib/rentalConfirmationOcrParse'
import type { ScheduleVehicleRow } from '@/lib/scheduleVehicleGridTypes'

function dash(value: string | null | undefined): string {
  const text = String(value || '').trim()
  return text || '—'
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function ymd(value: string | null | undefined): string {
  const text = String(value || '').trim().substring(0, 10)
  return text || '—'
}

function formatDateTime(date?: string | null, time?: string | null): string {
  const day = ymd(date)
  const clock = formatRentalTimeDisplay(time)
  if (day === '—' && !clock) return '—'
  return clock ? `${day} ${clock}` : day
}

function hasDoc(url: string | null | undefined): boolean {
  return Boolean(String(url || '').trim())
}

function HoverRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-white/70">{label}</span>
      <span className="min-w-0 text-right font-medium break-words">{value}</span>
    </div>
  )
}

function FileRow({ label, present, isKo }: { label: string; present: boolean; isKo: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/70">{label}</span>
      <span className={present ? 'font-medium text-emerald-300' : 'text-white/45'}>
        {present ? (isKo ? '있음' : 'Yes') : isKo ? '없음' : 'No'}
      </span>
    </div>
  )
}

export default function ScheduleRentalVehicleHoverContent({
  vehicle,
  locale,
  footer,
}: {
  vehicle: ScheduleVehicleRow
  locale: string
  footer?: string | undefined
}) {
  const isKo = locale === 'ko'
  const implied = rentalImpliedDailyUsd(
    Number(vehicle.rental_booking_price) || 0,
    vehicle.rental_start_date,
    vehicle.rental_end_date,
  )
  const dailyRate =
    implied?.perDay ??
    (vehicle.daily_rate != null && Number(vehicle.daily_rate) > 0 ? Number(vehicle.daily_rate) : null)

  return (
    <div className="min-w-[240px] space-y-1">
      <HoverRow
        label={isKo ? '예약자 (픽업 담당)' : 'Reserved by (pickup)'}
        value={dash(vehicle.rental_reserved_by_name || vehicle.rental_reserved_by)}
      />
      <HoverRow label="Reservation Number" value={dash(vehicle.vin)} />
      <HoverRow label={isKo ? '차종' : 'Type'} value={dash(vehicle.vehicle_type)} />
      <HoverRow
        label={isKo ? '기간' : 'Period'}
        value={`${formatDateTime(vehicle.rental_start_date, vehicle.rental_pickup_time)} ${isKo ? '픽업' : 'pickup'} ~ ${formatDateTime(vehicle.rental_end_date, vehicle.rental_return_time)} ${isKo ? '반납' : 'return'}`}
      />
      <HoverRow
        label={isKo ? '예약 가격' : 'Booking price'}
        value={formatUsd(vehicle.rental_booking_price)}
      />
      <HoverRow
        label={isKo ? '일일 환산' : 'Daily rate'}
        value={
          dailyRate == null
            ? '—'
            : implied
              ? `${formatUsd(implied.perDay)} · ${isKo ? `${implied.days}일 기준` : `${implied.days} days`}`
              : formatUsd(dailyRate)
        }
      />
      <div className="mt-1.5 space-y-0.5 border-t border-white/15 pt-1.5">
        <FileRow label="Rental reservations" present={hasDoc(vehicle.rental_reservation_url)} isKo={isKo} />
        <FileRow label="Rental Agreement File" present={hasDoc(vehicle.rental_agreement_file_url)} isKo={isKo} />
        <FileRow label="Rental Receipt" present={hasDoc(vehicle.rental_receipt_url)} isKo={isKo} />
      </div>
      {footer ? <div className="pt-1 text-white/55">{footer}</div> : null}
    </div>
  )
}
