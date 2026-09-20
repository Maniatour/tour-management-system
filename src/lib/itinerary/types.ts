export type CityCode = 'hanoi' | 'hcmc' | 'danang' | 'nhatrang' | 'phuquoc'

export type PartyType = 'any' | 'couple' | 'family' | 'parents' | 'friends' | 'solo'

export type PaceType = 'relaxed' | 'balanced' | 'full'

export type InterestTag =
  | 'mustsee'
  | 'food'
  | 'culture'
  | 'nature'
  | 'beach'
  | 'family'
  | 'photo'
  | 'night'
  | 'local'
  | 'wellness'

export type ItineraryDayBlock = {
  id: string
  city: CityCode
  title: string
  tags: InterestTag[]
  stops: string[]
  note?: string
}

export type ItineraryTemplate = {
  id: string
  city: CityCode
  name: string
  days: number
  parties: Exclude<PartyType, 'any'>[]
  pace: PaceType
  interests: InterestTag[]
  dayBlocks: string[]
}

export type ItineraryQuery = {
  city: CityCode
  days: number
  party: PartyType
  pace: PaceType
  interests: InterestTag[]
  freeText: string
}

export type ItineraryMatchDay = {
  blockId: string
  title: string
  stops: string[]
  note?: string
}

export type ItineraryMatch = {
  id: string
  name: string
  city: CityCode
  dayCount: number
  parties: Exclude<PartyType, 'any'>[]
  pace: PaceType
  score: number
  reasons: string[]
  days: ItineraryMatchDay[]
}
