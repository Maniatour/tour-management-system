import type { CustomerCommunicationChannel } from '@/lib/customerCommunicationChannel'

type BuildBookingGuestEventNoteInput = {
  localContactChannel?: string | null
  localContactHandle?: string | null
  localContactChannelLabel?: string | null
  alternativeDates?: string[]
  pickupHotelCustom?: string | null
  smsConsent?: boolean | null
  formatDateLabel?: (ymd: string) => string
}

export function buildBookingGuestEventNote(input: BuildBookingGuestEventNoteInput): string | null {
  const parts: string[] = []

  const channel = input.localContactChannel?.trim()
  const handle = input.localContactHandle?.trim()
  if (channel && handle) {
    const label = input.localContactChannelLabel?.trim() || channel
    parts.push(`Local contact (${label}): ${handle}`)
  }

  if (input.alternativeDates && input.alternativeDates.length > 0) {
    const dates = input.alternativeDates
      .map((ymd) => (input.formatDateLabel ? input.formatDateLabel(ymd) : ymd))
      .join(', ')
    parts.push(`Alternative tour dates: ${dates}`)
  }

  const customHotel = input.pickupHotelCustom?.trim()
  if (customHotel) {
    parts.push(`Pickup hotel request: ${customHotel}`)
  }

  if (input.smsConsent === true) {
    parts.push('SMS consent: Opted in')
  } else if (input.smsConsent === false) {
    parts.push('SMS consent: Declined')
  }

  return parts.length > 0 ? parts.join('\n') : null
}

export const BOOKING_LOCAL_CONTACT_CHANNELS = [
  'kakaotalk',
  'line',
  'whatsapp',
  'chatroom',
  'text_message',
  'phone_call',
  'email',
] as const satisfies readonly CustomerCommunicationChannel[]
