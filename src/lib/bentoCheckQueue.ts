export type BentoLineSource = 'reservation_option' | 'reservation_choice'

export type BentoLineItem = {
  key: string
  option_name: string
  quantity: number
  source: BentoLineSource
}

export type BentoReservationItem = {
  reservation_id: string
  customer_name: string
  lines: BentoLineItem[]
  total_quantity: number
}

export type BentoCheckTourRow = {
  id: string
  tour_date: string
  product_internal_name: string
  guide_name: string | null
  assistant_name: string | null
  vehicle_number: string | null
  assigned_people: number
  total_bento_quantity: number
  bento_lines: BentoLineItem[]
  reservations: BentoReservationItem[]
  order_id: string | null
  ordered_at: string | null
  ordered_by_email: string | null
  order_note: string | null
}

const BENTO_NAME_RE = /bento|도시락|lunch\s*box|lunchbox|boxed\s*lunch|점심\s*도시락/i

export function isBentoOptionName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false
  return BENTO_NAME_RE.test(name.trim())
}

export function isBentoCatalogOption(opt: {
  category?: string | null
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
}): boolean {
  const cat = (opt.category || '').toLowerCase().trim()
  if (cat === 'meal' || cat === '식사' || cat === 'bento') return true
  return [opt.name, opt.name_ko, opt.name_en].some((n) => isBentoOptionName(n))
}

export function isActiveReservationOptionStatus(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase().trim()
  if (!s) return true
  return s !== 'cancelled' && s !== 'canceled' && s !== 'refunded'
}

function optionDisplayName(opt: {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
}): string {
  return opt.name_ko?.trim() || opt.name?.trim() || opt.name_en?.trim() || '—'
}

function choiceOptionDisplayName(opt: {
  option_name_ko?: string | null
  option_name?: string | null
}): string {
  return opt.option_name_ko?.trim() || opt.option_name?.trim() || '—'
}

function mergeBentoLines(lines: BentoLineItem[]): BentoLineItem[] {
  const map = new Map<string, BentoLineItem>()
  for (const line of lines) {
    const mergeKey = `${line.source}:${line.option_name}`
    const existing = map.get(mergeKey)
    if (existing) {
      existing.quantity += line.quantity
    } else {
      map.set(mergeKey, { ...line, key: mergeKey })
    }
  }
  return [...map.values()].sort((a, b) => a.option_name.localeCompare(b.option_name, 'ko'))
}

export function buildBentoCheckTourRows(input: {
  tours: Array<{
    id: string
    tour_date: string
    reservation_ids?: unknown
    tour_guide_id?: string | null
    assistant_id?: string | null
    tour_car_id?: string | null
    products?: {
      name?: string | null
      name_ko?: string | null
      name_en?: string | null
    } | null
  }>
  reservations: Array<{
    id: string
    status: string | null
    customer_id?: string | null
    total_people?: number | null
    adults?: number | null
    child?: number | null
    infant?: number | null
  }>
  customers: Map<string, { name?: string | null }>
  reservationOptions: Array<{
    reservation_id: string | null
    option_id: string
    ea?: number | null
    status?: string | null
  }>
  optionsCatalog: Map<
    string,
    {
      name?: string | null
      name_ko?: string | null
      name_en?: string | null
      category?: string | null
    }
  >
  reservationChoices: Array<{
    reservation_id: string | null
    quantity?: number | null
    choice_options?: {
      option_name_ko?: string | null
      option_name?: string | null
    } | null
  }>
  teamMap: Map<string, { name_ko?: string | null; nick_name?: string | null; email?: string }>
  vehiclesMap: Map<string, { vehicle_number?: string | null }>
  ordersMap: Map<
    string,
    {
      id: string
      ordered_at: string | null
      ordered_by_email: string | null
      note: string | null
    }
  >
  assignedPeopleByTourId: Map<string, number>
}): BentoCheckTourRow[] {
  const {
    tours,
    reservations,
    customers,
    reservationOptions,
    optionsCatalog,
    reservationChoices,
    teamMap,
    vehiclesMap,
    ordersMap,
    assignedPeopleByTourId,
  } = input

  const reservationMap = new Map(reservations.map((r) => [r.id, r]))
  const rows: BentoCheckTourRow[] = []

  for (const tour of tours) {
    const reservationIds = Array.isArray(tour.reservation_ids)
      ? tour.reservation_ids.map((id) => String(id).trim()).filter(Boolean)
      : []

    const tourReservations: BentoReservationItem[] = []

    for (const reservationId of reservationIds) {
      const reservation = reservationMap.get(reservationId)
      if (!reservation) continue

      const lines: BentoLineItem[] = []

      for (const ro of reservationOptions) {
        if (ro.reservation_id !== reservationId) continue
        if (!isActiveReservationOptionStatus(ro.status)) continue
        const catalog = optionsCatalog.get(ro.option_id)
        if (!catalog || !isBentoCatalogOption(catalog)) continue
        const qty = Math.max(0, Number(ro.ea) || 0)
        if (qty <= 0) continue
        const optionName = optionDisplayName(catalog)
        lines.push({
          key: `option:${ro.option_id}`,
          option_name: optionName,
          quantity: qty,
          source: 'reservation_option',
        })
      }

      for (const rc of reservationChoices) {
        if (rc.reservation_id !== reservationId) continue
        const co = rc.choice_options
        if (!co) continue
        const optionName = choiceOptionDisplayName(co)
        if (!isBentoOptionName(optionName)) continue
        const qty = Math.max(0, Number(rc.quantity) || 0)
        if (qty <= 0) continue
        lines.push({
          key: `choice:${optionName}`,
          option_name: optionName,
          quantity: qty,
          source: 'reservation_choice',
        })
      }

      if (!lines.length) continue

      const customer = reservation.customer_id ? customers.get(reservation.customer_id) : undefined
      const customerName = customer?.name?.trim() || reservationId
      const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0)

      tourReservations.push({
        reservation_id: reservationId,
        customer_name: customerName,
        lines,
        total_quantity: totalQty,
      })
    }

    if (!tourReservations.length) continue

    const allLines = mergeBentoLines(tourReservations.flatMap((r) => r.lines))
    const totalBentoQuantity = allLines.reduce((sum, l) => sum + l.quantity, 0)
    const product =
      tour.products?.name_ko?.trim() ||
      tour.products?.name?.trim() ||
      tour.products?.name_en?.trim() ||
      '—'

    const guide = tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) : undefined
    const assistant = tour.assistant_id ? teamMap.get(tour.assistant_id) : undefined
    const vehicle = tour.tour_car_id ? vehiclesMap.get(tour.tour_car_id) : undefined
    const order = ordersMap.get(tour.id)

    rows.push({
      id: tour.id,
      tour_date: tour.tour_date,
      product_internal_name: product,
      guide_name: guide?.nick_name?.trim() || guide?.name_ko?.trim() || guide?.email || null,
      assistant_name:
        assistant?.nick_name?.trim() || assistant?.name_ko?.trim() || assistant?.email || null,
      vehicle_number: vehicle?.vehicle_number?.trim() || null,
      assigned_people: assignedPeopleByTourId.get(tour.id) ?? 0,
      total_bento_quantity: totalBentoQuantity,
      bento_lines: allLines,
      reservations: tourReservations,
      order_id: order?.id ?? null,
      ordered_at: order?.ordered_at ?? null,
      ordered_by_email: order?.ordered_by_email ?? null,
      order_note: order?.note ?? null,
    })
  }

  return rows.sort((a, b) => a.product_internal_name.localeCompare(b.product_internal_name, 'ko'))
}
