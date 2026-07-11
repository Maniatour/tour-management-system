export type TravelerCounts = {
  adults: number
  children: number
  infants: number
}

export const DEFAULT_TRAVELER_COUNTS: TravelerCounts = {
  adults: 2,
  children: 0,
  infants: 0,
}

export function getTravelerTotal(counts: TravelerCounts): number {
  return counts.adults + counts.children + counts.infants
}

export type TravelerAgeLimits = {
  adultAge: number
  childAgeMin: number
  childAgeMax: number
  infantAge: number
  maxParticipants: number
}

export const DEFAULT_TRAVELER_AGE_LIMITS: TravelerAgeLimits = {
  adultAge: 13,
  childAgeMin: 1,
  childAgeMax: 12,
  infantAge: 0,
  maxParticipants: 12,
}

export function clampTravelerCounts(
  counts: TravelerCounts,
  limits: TravelerAgeLimits
): TravelerCounts {
  const max = limits.maxParticipants
  let { adults, children, infants } = counts

  adults = Math.max(1, Math.min(adults, max))
  children = Math.max(0, Math.min(children, max))
  infants = Math.max(0, Math.min(infants, max))

  let total = adults + children + infants
  if (total > max) {
    const overflow = total - max
    if (infants >= overflow) {
      infants -= overflow
    } else {
      const remaining = overflow - infants
      infants = 0
      if (children >= remaining) {
        children -= remaining
      } else {
        children = 0
        adults = Math.max(1, adults - (remaining - children))
      }
    }
  }

  return { adults, children, infants }
}
