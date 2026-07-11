import type { LucideIcon } from 'lucide-react'
import {
  Bus,
  Building2,
  Camera,
  Handshake,
  Map,
  Mountain,
  PartyPopper,
  Plane,
  Route,
  Shield,
  Sparkles,
  Star,
  Tent,
  Ticket,
  TicketPercent,
} from 'lucide-react'

/** Product tag category icons keyed by tag page category id */
export const TAG_CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'antelope-canyon': Camera,
  'grand-canyon': Mountain,
  'suburban-tour': Map,
  'day-tour': Route,
  'accommodation-tour': Tent,
  'city-tour': Building2,
  'helicopter-tour': Plane,
  'light-aircraft-tour': Plane,
  'bus-tour': Bus,
  'premium-tour': Star,
  'performance-ticket': Ticket,
  attraction: Sparkles,
  event: PartyPopper,
  coupon: TicketPercent,
  insurance: Shield,
  'convention-support': Handshake,
}

export function getTagCategoryIcon(categoryId: string): LucideIcon {
  return TAG_CATEGORY_ICON_MAP[categoryId] ?? Map
}
