import type { OtaPlatform } from '@/lib/commerce/ota/types'

export type OtaInboundEventType =
  | 'booking_created'
  | 'booking_updated'
  | 'booking_cancelled'
  | 'booking_status'

export type OtaInboundStatus =
  | 'received'
  | 'processing'
  | 'processed'
  | 'skipped'
  | 'failed'

/** Normalized fields extracted from platform webhook payloads */
export type NormalizedOtaInboundBooking = {
  externalEventId: string
  externalBookingId: string | null
  externalSku: string | null
  eventType: OtaInboundEventType
  tourDate: string | null
  adults: number
  child: number
  infant: number
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  currency: string | null
  totalAmount: number | null
  raw: Record<string, unknown>
}

export type OtaInboundReceiveResult = {
  inboundId: string
  created: boolean
  platform: OtaPlatform
  status: OtaInboundStatus
}
