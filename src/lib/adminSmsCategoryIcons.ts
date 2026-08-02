import {
  Bell,
  Bus,
  Calendar,
  Car,
  Clock,
  ClipboardList,
  Hotel,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Phone,
  RotateCcw,
  Send,
  Smartphone,
  Users,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'

export const ADMIN_SMS_CATEGORY_ICON_OPTIONS = [
  { key: 'smartphone', labelKo: '스마트폰', labelEn: 'Smartphone' },
  { key: 'message-square', labelKo: '메시지', labelEn: 'Message' },
  { key: 'messages-square', labelKo: '메시지들', labelEn: 'Messages' },
  { key: 'message-circle', labelKo: '채팅', labelEn: 'Chat' },
  { key: 'send', labelKo: '발송', labelEn: 'Send' },
  { key: 'bus', labelKo: '버스', labelEn: 'Bus' },
  { key: 'car', labelKo: '차량', labelEn: 'Car' },
  { key: 'map-pin', labelKo: '위치', labelEn: 'Location' },
  { key: 'hotel', labelKo: '호텔', labelEn: 'Hotel' },
  { key: 'calendar', labelKo: '일정', labelEn: 'Calendar' },
  { key: 'clipboard-list', labelKo: '체크리스트', labelEn: 'Checklist' },
  { key: 'clock', labelKo: '시계', labelEn: 'Clock' },
  { key: 'bell', labelKo: '알림', labelEn: 'Bell' },
  { key: 'phone', labelKo: '전화', labelEn: 'Phone' },
  { key: 'mail', labelKo: '메일', labelEn: 'Mail' },
  { key: 'users', labelKo: '사용자', labelEn: 'Users' },
  { key: 'user-check', labelKo: '배정 확인', labelEn: 'Assignment' },
  { key: 'rotate-ccw', labelKo: '재시도', labelEn: 'Retry' },
] as const

export type AdminSmsCategoryIconKey = (typeof ADMIN_SMS_CATEGORY_ICON_OPTIONS)[number]['key']

const ADMIN_SMS_CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  'message-square': MessageSquare,
  'messages-square': MessagesSquare,
  'message-circle': MessageCircle,
  send: Send,
  bus: Bus,
  car: Car,
  'map-pin': MapPin,
  hotel: Hotel,
  calendar: Calendar,
  'clipboard-list': ClipboardList,
  clock: Clock,
  bell: Bell,
  phone: Phone,
  mail: Mail,
  users: Users,
  'user-check': UserCheck,
  'rotate-ccw': RotateCcw,
}

export function resolveAdminSmsCategoryIcon(iconKey?: string | null): LucideIcon {
  const key = iconKey?.trim()
  if (!key) return Smartphone
  return ADMIN_SMS_CATEGORY_ICON_MAP[key] ?? Smartphone
}

export function isValidAdminSmsCategoryIconKey(key: string): key is AdminSmsCategoryIconKey {
  return ADMIN_SMS_CATEGORY_ICON_OPTIONS.some((o) => o.key === key)
}
