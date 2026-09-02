import type { CustomerCommunicationChannel } from '@/lib/customerCommunicationChannel'

type BuildBookingGuestEventNoteInput = {
  localContactChannel?: string | null
  localContactChannels?: string[] | null
  localContactHandle?: string | null
  localContactChannelLabel?: string | null
  alternativeDates?: string[]
  pickupHotelCustom?: string | null
  smsConsent?: boolean | null
  formatDateLabel?: (ymd: string) => string
}

const LOCAL_CONTACT_NOTE_LABELS: Record<string, string> = {
  kakaotalk: 'KakaoTalk',
  line: 'Line',
  whatsapp: 'WhatsApp',
  chatroom: 'Tour Chat',
  text_message: 'Text message',
  phone_call: 'Phone call',
  email: 'Email',
}

export function normalizeLocalContactChannels(
  channels: string | string[] | null | undefined
): string[] {
  const raw = Array.isArray(channels)
    ? channels
    : typeof channels === 'string'
      ? channels.split(',')
      : []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    const value = item.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

export function formatLocalContactNoteLabels(
  channels: string[],
  overrideLabel?: string | null
): string {
  const override = overrideLabel?.trim()
  if (override) return override
  return channels.map((channel) => LOCAL_CONTACT_NOTE_LABELS[channel] || channel).join(', ')
}

export function buildBookingGuestEventNote(input: BuildBookingGuestEventNoteInput): string | null {
  const parts: string[] = []

  const channels = normalizeLocalContactChannels(
    input.localContactChannels?.length ? input.localContactChannels : input.localContactChannel
  )
  const handle = input.localContactHandle?.trim()
  if (channels.length > 0) {
    const label = formatLocalContactNoteLabels(channels, input.localContactChannelLabel)
    parts.push(handle ? `Local contact (${label}): ${handle}` : `Local contact: ${label}`)
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
