import type { LucideIcon } from 'lucide-react'
import { Bus, Car, Plane, PlaneTakeoff } from 'lucide-react'

export type TransportationIconResult = {
  icon: LucideIcon
  label: string
}

export function getTransportationIcon(
  method: string,
  locale: string
): TransportationIconResult {
  const isEnglish = locale === 'en'
  const iconMap: Record<string, TransportationIconResult> = {
    minivan: { icon: Car, label: isEnglish ? 'Minivan' : '미니밴' },
    van: { icon: Car, label: isEnglish ? 'Van' : '밴' },
    bus: { icon: Bus, label: isEnglish ? 'Bus' : '버스' },
    helicopter: { icon: Plane, label: isEnglish ? 'Helicopter' : '헬리콥터' },
    light_aircraft: { icon: PlaneTakeoff, label: isEnglish ? 'Light Aircraft' : '경비행기' },
    aircraft: { icon: PlaneTakeoff, label: isEnglish ? 'Aircraft' : '비행기' },
    limousine: { icon: Car, label: isEnglish ? 'Limousine' : '리무진' },
    car: { icon: Car, label: isEnglish ? 'Car' : '승용차' },
    suv: { icon: Car, label: isEnglish ? 'SUV' : 'SUV' },
  }

  const normalizedMethod = method.toLowerCase().trim()
  return iconMap[normalizedMethod] ?? { icon: Car, label: method }
}
