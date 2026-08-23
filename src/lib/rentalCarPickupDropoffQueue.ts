import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { formatRentalTimeDisplay } from '@/lib/rentalConfirmationOcrParse'
import { teamMemberNameForLocale } from '@/lib/teamMemberDisplayName'
import { OP_TODO_LV_TZ } from '@/lib/opTodoBusinessDay'

dayjs.extend(utc)
dayjs.extend(timezone)

export function rentalCarPickupDropoffTodayYmd(): string {
  return dayjs().tz(OP_TODO_LV_TZ).format('YYYY-MM-DD')
}

export function isNightGoblinProduct(input: {
  productId?: string | null
  name?: string | null
  nameKo?: string | null
  nameEn?: string | null
}): boolean {
  const productId = String(input.productId || '').trim().toUpperCase()
  if (
    productId === 'MDGCSUNRISE' ||
    productId.startsWith('MDGCSUNRISE') ||
    productId.startsWith('MDGCSUNR')
  ) {
    return true
  }
  const ko = `${input.nameKo || ''} ${input.name || ''}`
  const en = `${input.nameEn || ''} ${input.name || ''}`.toLowerCase()
  return ko.includes('밤도깨비') || /night\s*goblin|midnight\s*goblin/i.test(en)
}

export type RentalCarStaffMember = {
  email: string
  displayName: string
  phone: string | null
  languages: string[] | string | null
  nameKo: string
  nameEn: string
}

export type RentalCarAssignedTour = {
  id: string
  tourDate: string
  productName: string
  productId: string | null
  isNightGoblin: boolean
  guide: RentalCarStaffMember | null
  assistant: RentalCarStaffMember | null
}

export type RentalCarContinuingCrew = {
  vehicleId: string
  vehicleLabel: string
  tour: RentalCarAssignedTour
}

export type RentalCarPickupDropoffCard = {
  itemId: string
  kind: 'pickup' | 'return'
  vehicleId: string
  vehicleLabel: string
  vehicleNumber: string
  nick: string | null
  rentalCompany: string | null
  agreementNumber: string | null
  startDate: string | null
  endDate: string | null
  pickupTime: string | null
  returnTime: string | null
  pickupLocation: string | null
  returnLocation: string | null
  status: string
  reservedByEmail: string | null
  reservedBy: RentalCarStaffMember | null
  lastTour: RentalCarAssignedTour | null
  continuingCrews: RentalCarContinuingCrew[]
}

export type RentalCarTeamOption = {
  email: string
  displayName: string
}

export type VehicleRentalRow = {
  id: string
  vehicle_number: string | null
  nick: string | null
  status: string | null
  vehicle_category: string | null
  rental_company: string | null
  rental_agreement_number: string | null
  rental_start_date: string | null
  rental_end_date: string | null
  rental_pickup_location: string | null
  rental_return_location: string | null
  rental_pickup_time: string | null
  rental_return_time: string | null
  rental_reserved_by: string | null
}

export type TourAssignmentRow = {
  id: string
  tour_date: string
  tour_status?: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
  tour_car_id?: string | null
  product_id?: string | null
  products?: {
    id?: string | null
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
  } | null
}

export type TeamNameRow = {
  email: string
  name_ko?: string | null
  name_en?: string | null
  nick_name?: string | null
  display_name?: string | null
  phone?: string | null
  is_active?: boolean | null
  languages?: string[] | string | null
}

function ymd(value: string | null | undefined): string {
  return String(value || '').trim().substring(0, 10)
}

export function rentalVehicleLabel(vehicle: {
  nick?: string | null
  vehicle_number?: string | null
}): string {
  return String(vehicle.nick || vehicle.vehicle_number || '').trim() || '—'
}

export function formatRentalPickupDropoffTime(raw: string | null | undefined): string {
  return formatRentalTimeDisplay(raw)
}

export function staffDisplayName(member: TeamNameRow | undefined, fallbackEmail: string, locale: string): string {
  if (!member) return fallbackEmail
  return teamMemberNameForLocale(member, locale) || fallbackEmail
}

function toStaff(
  email: string | null | undefined,
  teamMap: Map<string, TeamNameRow>,
  locale: string
): RentalCarStaffMember | null {
  const key = String(email || '').trim()
  if (!key) return null
  const member = teamMap.get(key.toLowerCase()) ?? teamMap.get(key)
  return {
    email: member?.email || key,
    displayName: staffDisplayName(member, key, locale),
    phone: member?.phone?.trim() || null,
    languages: member?.languages ?? null,
    nameKo: staffDisplayName(member, key, 'ko'),
    nameEn: staffDisplayName(member, key, 'en'),
  }
}

function productName(tour: TourAssignmentRow): string {
  const product = tour.products
  return (
    product?.name_ko?.trim() ||
    product?.name?.trim() ||
    product?.name_en?.trim() ||
    tour.product_id ||
    '—'
  )
}

export function toAssignedTour(
  tour: TourAssignmentRow,
  teamMap: Map<string, TeamNameRow>,
  locale: string
): RentalCarAssignedTour {
  const product = tour.products
  return {
    id: tour.id,
    tourDate: ymd(tour.tour_date),
    productName: productName(tour),
    productId: tour.product_id ?? product?.id ?? null,
    isNightGoblin: isNightGoblinProduct({
      productId: tour.product_id ?? product?.id ?? null,
      name: product?.name ?? null,
      nameKo: product?.name_ko ?? null,
      nameEn: product?.name_en ?? null,
    }),
    guide: toStaff(tour.tour_guide_id, teamMap, locale),
    assistant: toStaff(tour.assistant_id, teamMap, locale),
  }
}

function lastTourForVehicle(
  vehicleId: string,
  tours: TourAssignmentRow[],
  endDate: string | null,
  teamMap: Map<string, TeamNameRow>,
  locale: string
): RentalCarAssignedTour | null {
  const related = tours.filter((tour) => tour.tour_car_id === vehicleId)
  if (!related.length) return null

  const end = ymd(endDate)
  const scored = related
    .map((tour) => {
      const date = ymd(tour.tour_date)
      let score = 0
      if (end && date === end) score = 3
      else if (end && date < end) score = 2
      else score = 1
      return { tour, date, score }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.date.localeCompare(a.date)
    })

  const picked = scored[0]?.tour
  return picked ? toAssignedTour(picked, teamMap, locale) : null
}

function continuingCrewsForReturn(input: {
  returnVehicleId: string
  lastTour: RentalCarAssignedTour | null
  vehicles: VehicleRentalRow[]
  tours: TourAssignmentRow[]
  today: string
  teamMap: Map<string, TeamNameRow>
  locale: string
}): RentalCarContinuingCrew[] {
  const lastTour = input.lastTour
  if (!lastTour) return []

    const crews: RentalCarContinuingCrew[] = []

    for (const tour of input.tours) {
      const vehicleId = String(tour.tour_car_id || '').trim()
      if (!vehicleId || vehicleId === input.returnVehicleId) continue

      const vehicle = input.vehicles.find((v) => v.id === vehicleId)
      if (!vehicle || vehicle.vehicle_category !== 'rental') continue
      if (ymd(vehicle.rental_end_date) === input.today) continue

      const assigned = toAssignedTour(tour, input.teamMap, input.locale)
      if (assigned.tourDate !== lastTour.tourDate) continue

      crews.push({
        vehicleId,
        vehicleLabel: rentalVehicleLabel(vehicle),
        tour: assigned,
      })
    }

  const seen = new Set<string>()
  return crews.filter((crew) => {
    if (seen.has(crew.vehicleId)) return false
    seen.add(crew.vehicleId)
    return Boolean(crew.tour.guide || crew.tour.assistant)
  })
}

export function buildRentalCarPickupDropoffCards(input: {
  today: string
  vehicles: VehicleRentalRow[]
  tours: TourAssignmentRow[]
  teamMap: Map<string, TeamNameRow>
  locale: string
}): { pickups: RentalCarPickupDropoffCard[]; returns: RentalCarPickupDropoffCard[] } {
  const pickups: RentalCarPickupDropoffCard[] = []
  const returns: RentalCarPickupDropoffCard[] = []

  for (const vehicle of input.vehicles) {
    const start = ymd(vehicle.rental_start_date)
    const end = ymd(vehicle.rental_end_date)
    const reservedBy = toStaff(vehicle.rental_reserved_by, input.teamMap, input.locale)
    const lastTour = lastTourForVehicle(vehicle.id, input.tours, vehicle.rental_end_date, input.teamMap, input.locale)
    const base = {
      vehicleId: vehicle.id,
      vehicleLabel: rentalVehicleLabel(vehicle),
      vehicleNumber: String(vehicle.vehicle_number || '').trim(),
      nick: vehicle.nick?.trim() || null,
      rentalCompany: vehicle.rental_company?.trim() || null,
      agreementNumber: vehicle.rental_agreement_number?.trim() || null,
      startDate: start || null,
      endDate: end || null,
      pickupTime: String(vehicle.rental_pickup_time || '').trim() || null,
      returnTime: String(vehicle.rental_return_time || '').trim() || null,
      pickupLocation: vehicle.rental_pickup_location?.trim() || null,
      returnLocation: vehicle.rental_return_location?.trim() || vehicle.rental_pickup_location?.trim() || null,
      status: String(vehicle.status || '').trim() || 'available',
      reservedByEmail: vehicle.rental_reserved_by?.trim() || null,
      reservedBy,
      lastTour,
    }

    if (start === input.today) {
      pickups.push({
        ...base,
        itemId: `pickup:${vehicle.id}`,
        kind: 'pickup',
        continuingCrews: [],
      })
    }

    if (end === input.today) {
      returns.push({
        ...base,
        itemId: `return:${vehicle.id}`,
        kind: 'return',
        continuingCrews: continuingCrewsForReturn({
          returnVehicleId: vehicle.id,
          lastTour,
          vehicles: input.vehicles,
          tours: input.tours,
          today: input.today,
          teamMap: input.teamMap,
          locale: input.locale,
        }),
      })
    }
  }

  const byLabel = (a: RentalCarPickupDropoffCard, b: RentalCarPickupDropoffCard) =>
    a.vehicleLabel.localeCompare(b.vehicleLabel, 'ko')

  return {
    pickups: pickups.sort(byLabel),
    returns: returns.sort(byLabel),
  }
}

export function rentalCarCardRecipients(
  card: RentalCarPickupDropoffCard,
  kind: 'pickup' | 'return' | 'airport_shuttle',
  continuingVehicleId?: string | null
): RentalCarStaffMember[] {
  if (kind === 'pickup') {
    return card.reservedBy ? [card.reservedBy] : []
  }
  if (kind === 'return') {
    return [card.lastTour?.guide, card.lastTour?.assistant].filter(
      (m): m is RentalCarStaffMember => Boolean(m)
    )
  }
  const crew = card.continuingCrews.find((c) => c.vehicleId === continuingVehicleId) ?? card.continuingCrews[0]
  if (!crew) return []
  return [crew.tour.guide, crew.tour.assistant].filter((m): m is RentalCarStaffMember => Boolean(m))
}

export function formatStaffNames(members: Array<RentalCarStaffMember | null | undefined>): string {
  return members
    .filter((m): m is RentalCarStaffMember => Boolean(m?.displayName))
    .map((m) => m.displayName)
    .join(', ')
}

export function staffNameForSms(
  member: RentalCarStaffMember,
  locale: 'ko' | 'en'
): string {
  if (locale === 'en') return member.nameEn || member.displayName
  return member.nameKo || member.displayName
}

export function formatStaffNamesForSms(
  members: Array<RentalCarStaffMember | null | undefined>,
  locale: 'ko' | 'en'
): string {
  return members
    .filter((m): m is RentalCarStaffMember => Boolean(m))
    .map((m) => staffNameForSms(m, locale))
    .filter(Boolean)
    .join(', ')
}
