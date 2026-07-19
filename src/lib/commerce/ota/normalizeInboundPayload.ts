import type {
  NormalizedOtaInboundBooking,
  OtaInboundEventType,
} from '@/lib/commerce/ota/inboundTypes'
import type { OtaPlatform } from '@/lib/commerce/ota/types'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

function mapEventType(raw: string | null): OtaInboundEventType {
  const v = (raw || '').toLowerCase()
  if (v.includes('cancel')) return 'booking_cancelled'
  if (v.includes('update') || v.includes('amend')) return 'booking_updated'
  if (v.includes('status')) return 'booking_status'
  return 'booking_created'
}

/**
 * Normalize inbound webhook JSON into a common booking shape.
 * Accepts our test envelope or a loose Viator-like payload.
 */
export function normalizeInboundPayload(
  platform: OtaPlatform,
  body: unknown
): NormalizedOtaInboundBooking {
  const raw = asRecord(body)
  const booking = asRecord(raw.booking || raw.data || raw.reservation || raw)
  const customer = asRecord(booking.customer || booking.traveller || raw.customer)
  const party = asRecord(booking.party || booking.pax || booking.guests)

  const externalEventId =
    str(raw.eventId) ||
    str(raw.event_id) ||
    str(raw.id) ||
    str(booking.bookingRef) ||
    str(booking.booking_ref) ||
    str(booking.id) ||
    `${platform}-${Date.now()}`

  const externalBookingId =
    str(booking.bookingRef) ||
    str(booking.booking_ref) ||
    str(booking.externalBookingId) ||
    str(booking.id) ||
    null

  const externalSku =
    str(booking.sku) ||
    str(booking.externalSku) ||
    str(booking.productCode) ||
    str(booking.product_code) ||
    str(raw.externalSku) ||
    str(raw.sku) ||
    null

  const tourDate =
    str(booking.tourDate) ||
    str(booking.tour_date) ||
    str(booking.travelDate) ||
    str(booking.travel_date) ||
    str(booking.date) ||
    null

  const adults = Math.max(
    1,
    num(party.adults ?? booking.adults ?? raw.adults, 1)
  )
  const child = num(party.children ?? party.child ?? booking.child ?? raw.child, 0)
  const infant = num(party.infants ?? party.infant ?? booking.infant ?? raw.infant, 0)

  return {
    externalEventId,
    externalBookingId,
    externalSku,
    eventType: mapEventType(str(raw.eventType) || str(raw.type) || str(raw.event)),
    tourDate,
    adults,
    child,
    infant,
    customerName:
      str(customer.name) ||
      str(customer.fullName) ||
      [str(customer.firstName), str(customer.lastName)].filter(Boolean).join(' ') ||
      null,
    customerEmail: str(customer.email) || str(booking.email) || null,
    customerPhone:
      str(customer.phone) ||
      str(customer.mobile) ||
      str(booking.phone) ||
      null,
    currency: str(booking.currency) || str(raw.currency) || 'USD',
    totalAmount:
      typeof booking.total === 'number'
        ? booking.total
        : typeof booking.totalAmount === 'number'
          ? booking.totalAmount
          : null,
    raw,
  }
}
