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
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Tent,
  Ticket,
} from 'lucide-react'

/** Home category tile icons keyed by i18n labelKey */
export const HOME_CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  antelopeCanyon: Camera,
  grandCanyon: Mountain,
  suburbanTour: Map,
  dayTour: Route,
  accommodationTour: Tent,
  cityTour: Building2,
  helicopterTour: Plane,
  lightAircraftTour: Plane,
  busTour: Bus,
  premiumTour: Star,
  performanceTicket: Ticket,
  attraction: Sparkles,
  categoryEvent: PartyPopper,
  categoryCoupon: Scissors,
  categoryTravelInsurance: ShieldCheck,
  categoryConventionSupport: Handshake,
}

export function getHomeCategoryIcon(labelKey: string): LucideIcon {
  return HOME_CATEGORY_ICON_MAP[labelKey] ?? Map
}
