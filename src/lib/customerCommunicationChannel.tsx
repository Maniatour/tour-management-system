import type { LucideIcon } from 'lucide-react'
import { Globe, Mail, MessageCircleOff, MessagesSquare, Phone, Smartphone } from 'lucide-react'
import type React from 'react'
import { PLATFORM_CHANNEL_MAP } from '@/lib/platformChannelMapping'

export const CUSTOMER_COMMUNICATION_CHANNELS = [
  'no_reply',
  'platform',
  'email',
  'whatsapp',
  'text_message',
  'kakaotalk',
  'phone_call',
  'chatroom',
] as const

export type CustomerCommunicationChannel = (typeof CUSTOMER_COMMUNICATION_CHANNELS)[number]

const PLATFORM_MESSAGING_CHANNEL_IDS = new Set(
  Object.values(PLATFORM_CHANNEL_MAP).map((id) => id.trim().toLowerCase()).filter(Boolean)
)

const PLATFORM_MESSAGING_NAME_PARTS = [
  'getyourguide',
  'get your guide',
  'viator',
  'klook',
  'kkday',
  'trip.com',
  'tripadvisor',
  'booking.com',
  'expedia',
  'airbnb',
  'myrealtrip',
  'tidesquare',
] as const

/** OTA 자체 채팅·메시징(예: GetYourGuide)으로 소통하는 예약 채널 */
export function reservationUsesPlatformMessagingChannel(
  channelId: string | null | undefined,
  channelName?: string | null
): boolean {
  const id = (channelId ?? '').trim().toLowerCase()
  if (id && PLATFORM_MESSAGING_CHANNEL_IDS.has(id)) return true
  const n = (channelName ?? '').trim().toLowerCase()
  if (!n) return false
  return PLATFORM_MESSAGING_NAME_PARTS.some((part) => n.includes(part))
}

export type ResolveCustomerCommunicationChannelOpts = {
  channelId?: string | null
  channelName?: string | null
}

/** DB 값이 없을 때 예약 채널에 따라 표시·기본 소통 채널 결정 */
export function resolveCustomerCommunicationChannel(
  raw: string | null | undefined,
  opts?: ResolveCustomerCommunicationChannelOpts
): CustomerCommunicationChannel {
  const v = (raw ?? '').trim().toLowerCase()
  if ((CUSTOMER_COMMUNICATION_CHANNELS as readonly string[]).includes(v)) {
    return v as CustomerCommunicationChannel
  }
  if (opts && reservationUsesPlatformMessagingChannel(opts.channelId, opts.channelName)) {
    return 'platform'
  }
  return 'no_reply'
}

export function normalizeCustomerCommunicationChannel(
  raw: string | null | undefined,
  opts?: ResolveCustomerCommunicationChannelOpts
): CustomerCommunicationChannel {
  return resolveCustomerCommunicationChannel(raw, opts)
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function KakaoTalkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#FEE500" />
      <path
        fill="#3C1E1E"
        d="M12 5.5c-4.2 0-7.6 2.6-7.6 5.8 0 1.9 1.2 3.6 3 4.7l-.7 2.6 3-1.8c.4.05.8.08 1.3.08 4.2 0 7.6-2.6 7.6-5.8S16.2 5.5 12 5.5z"
      />
    </svg>
  )
}

type ChannelVisual = {
  Icon: LucideIcon | ((props: { className?: string }) => React.ReactNode)
  toneClass: string
}

export const CUSTOMER_COMMUNICATION_CHANNEL_VISUAL: Record<CustomerCommunicationChannel, ChannelVisual> = {
  no_reply: { Icon: MessageCircleOff, toneClass: 'text-gray-400' },
  platform: { Icon: Globe, toneClass: 'text-indigo-600' },
  email: { Icon: Mail, toneClass: 'text-primary' },
  whatsapp: { Icon: WhatsAppIcon, toneClass: 'text-green-600' },
  text_message: { Icon: Smartphone, toneClass: 'text-violet-600' },
  kakaotalk: { Icon: KakaoTalkIcon, toneClass: 'text-[#3C1E1E]' },
  phone_call: { Icon: Phone, toneClass: 'text-amber-700' },
  chatroom: { Icon: MessagesSquare, toneClass: 'text-teal-600' },
}

export function renderCustomerCommunicationChannelIcon(
  channel: CustomerCommunicationChannel,
  className: string
): React.ReactNode {
  const { Icon, toneClass } = CUSTOMER_COMMUNICATION_CHANNEL_VISUAL[channel]
  const merged = `${className} ${toneClass}`.trim()
  if (channel === 'whatsapp' || channel === 'kakaotalk') {
    const BrandIcon = Icon as (props: { className?: string }) => React.ReactNode
    return <BrandIcon className={merged} />
  }
  const Lucide = Icon as LucideIcon
  return <Lucide className={merged} aria-hidden />
}

/** i18n key under reservations.card.communicationChannel.* */
export function communicationChannelLabelKey(channel: CustomerCommunicationChannel): string {
  return `communicationChannel.${channel}`
}
