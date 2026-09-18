import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { chunkStrings } from '@/lib/supabaseInChunks'
import { loadCalendarChoiceRows } from '@/lib/fetchCanyonChoiceRows'
import { ticketBookingCanyonKeyFromBooking } from '@/lib/ticketBookingDateView'
import {
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeReservationIds,
  parseTourAssignmentEmails,
} from '@/utils/tourUtils'
import {
  ageOnTourDate,
  buildLeadCompanionRoster,
  CANYON_WAIVER_COMPANY_NAME,
  formatCanyonFormDate,
  formatCanyonFormTime,
  countryFromCustomerLanguage,
  pickEnglishPrintName,
  pickReusableWaiverSignature,
  printNameForPartySlot,
  type CanyonWaiverPrintPacket,
  type CanyonWaiverPrintTourPayload,
} from '@/lib/canyonWaiverPrintForms'

export const runtime = 'nodejs'

type CanyonPrintKey = 'X' | 'L'

type RezRow = {
  id: string
  customer_id?: string | null
  channel_rn?: string | null
  tour_date?: string | null
  tour_time?: string | null
  product_id?: string | null
  canyon_choice?: string | null
  choices?: unknown
  adults?: number | null
  child?: number | null
  infant?: number | null
  total_people?: number | null
  status?: string | null
}

type ParticipantRow = {
  id: string
  reservation_id: string
  slot_index: number
  full_legal_name: string | null
  placeholder_label: string
  participant_type: string | null
  date_of_birth: string | null
}

type AcceptanceRow = {
  participant_id: string
  reservation_id: string
  document_code: string
  signature_id: string | null
  status: string | null
}

type RcRow = {
  reservation_id: string
  order_index: number | null
  name: string | null
  name_en: string | null
  name_ko: string | null
}

type TicketRow = {
  id?: string
  reservation_id?: string | null
  tour_id?: string | null
  company?: string | null
  category?: string | null
  check_in_date?: string | null
  time?: string | null
  rn_number?: string | null
  vendor_confirmation_number?: string | null
  invoice_number?: string | null
  status?: string | null
  booking_status?: string | null
}

async function selectInChunks<T>(
  table: string,
  columns: string,
  column: string,
  ids: string[]
): Promise<T[]> {
  const client = supabaseAdmin
  if (!client || ids.length === 0) return []
  const parts = await Promise.all(
    chunkStrings(ids).map(async (chunk) => {
      const { data, error } = await fromUntypedTable(client, table)
        .select(columns)
        .in(column, chunk)
      if (error) {
        console.warn(`[print-tour] ${table}`, error.message)
        return [] as T[]
      }
      return (data ?? []) as T[]
    })
  )
  return parts.flat()
}

function storagePathKey(value: string): string {
  try {
    return decodeURIComponent(String(value || '').replace(/^\/+/, '')).replace(/\\/g, '/')
  } catch {
    return String(value || '')
  }
}

async function signedUrlsForSignatures(
  rows: Array<{ id: string; storage_key: string }>
): Promise<Record<string, string>> {
  const client = supabaseAdmin
  const unique = [...new Map(rows.filter((r) => r.id && r.storage_key).map((r) => [r.id, r])).values()]
  if (!client || unique.length === 0) return {}
  const urls: Record<string, string> = {}
  const byPath = new Map<string, string>()

  const chunks = chunkStrings(
    unique.map((r) => r.storage_key),
    40
  )
  await Promise.all(
    chunks.map(async (keys) => {
      const { data, error } = await client.storage.from('waiver-signatures').createSignedUrls(keys, 60 * 60)
      if (error || !data?.length) return
      for (const item of data) {
        const url = item.signedUrl || (item as { signedURL?: string }).signedURL
        if (!item.path || !url) continue
        byPath.set(item.path, url)
        byPath.set(storagePathKey(item.path), url)
      }
    })
  )

  for (const row of unique) {
    const url = byPath.get(row.storage_key) || byPath.get(storagePathKey(row.storage_key))
    if (url) urls[row.id] = url
  }

  const missing = unique.filter((r) => !urls[r.id])
  if (missing.length === 0) return urls
  await Promise.all(
    missing.map(async (sig) => {
      const { data: one } = await client.storage
        .from('waiver-signatures')
        .createSignedUrl(sig.storage_key, 60 * 60)
      if (one?.signedUrl) urls[sig.id] = one.signedUrl
    })
  )
  return urls
}

function partySize(rez: RezRow): number {
  const total = Number(rez.total_people ?? 0)
  if (total > 0) return total
  return Math.max(1, Number(rez.adults ?? 0) + Number(rez.child ?? 0) + Number(rez.infant ?? 0))
}

function isActiveTicket(row: TicketRow): boolean {
  const blob = `${row.status ?? ''} ${row.booking_status ?? ''}`.toLowerCase()
  return !blob.includes('cancel')
}

function modeValue(values: Array<string | null | undefined>): string {
  const counts = new Map<string, number>()
  for (const raw of values) {
    const value = String(raw ?? '').trim()
    if (!value) continue
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  let best = ''
  let n = 0
  for (const [key, count] of counts) {
    if (count > n) {
      best = key
      n = count
    }
  }
  return best
}

function partyAdultsMinors(rez: RezRow): { adults: number; minors: number } {
  const adults = Math.max(0, Number(rez.adults ?? 0))
  const minors = Math.max(0, Number(rez.child ?? 0) + Number(rez.infant ?? 0))
  if (adults + minors > 0) return { adults, minors }
  const total = partySize(rez)
  return { adults: total, minors: 0 }
}

function canyonKeysOf(rows: Array<{ choiceKey: string }> | undefined): CanyonPrintKey[] {
  const present = new Set<CanyonPrintKey>()
  for (const row of rows || []) {
    if (row.choiceKey === 'X' || row.choiceKey === 'L') present.add(row.choiceKey)
  }
  return (['X', 'L'] as CanyonPrintKey[]).filter((key) => present.has(key))
}

export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })

  const tourId = request.nextUrl.searchParams.get('tourId')?.trim()
  if (!tourId) return NextResponse.json({ error: 'tourId required' }, { status: 400 })

  const { data: tour, error: tourErr } = await fromUntypedTable(supabaseAdmin, 'tours')
    .select('id, tour_date, antelope_check_in_date, reservation_ids, tour_guide_id')
    .eq('id', tourId)
    .maybeSingle()
  if (tourErr || !tour) return NextResponse.json({ error: 'Tour not found' }, { status: 404 })

  const tourDateYmd = String(tour.tour_date ?? '')
  const antelopeCheckInYmd = String(tour.antelope_check_in_date ?? '')
  const assignedIds = normalizeReservationIds(tour.reservation_ids)
  const guideEmail = parseTourAssignmentEmails(String(tour.tour_guide_id ?? ''))[0]

  const ticketSelect =
    'id, reservation_id, tour_id, company, category, check_in_date, time, rn_number, vendor_confirmation_number, invoice_number, status, booking_status'

  const [rawReservations, ticketsByTour, ticketsByRes, teamMember, participants, acceptances, rcRows, guideSigRows, submissions] =
    await Promise.all([
      selectInChunks<RezRow>(
        'reservations',
        'id, customer_id, channel_rn, tour_date, tour_time, product_id, canyon_choice, choices, adults, child, infant, total_people, status',
        'id',
        assignedIds
      ),
      fromUntypedTable(supabaseAdmin, 'ticket_bookings')
        .select(ticketSelect)
        .eq('tour_id', tourId)
        .then((res) => (res.data ?? []) as TicketRow[]),
      selectInChunks<TicketRow>('ticket_bookings', ticketSelect, 'reservation_id', assignedIds),
      guideEmail
        ? fromUntypedTable(supabaseAdmin, 'team')
            .select('name_en, name_ko, nick_name, phone, email')
            .ilike('email', guideEmail)
            .maybeSingle()
            .then((res) => res.data)
        : Promise.resolve(null),
      selectInChunks<ParticipantRow>(
        'waiver_participants',
        'id, reservation_id, slot_index, full_legal_name, placeholder_label, participant_type, date_of_birth',
        'reservation_id',
        assignedIds
      ),
      selectInChunks<AcceptanceRow>(
        'waiver_acceptances',
        'participant_id, reservation_id, document_code, signature_id, status',
        'reservation_id',
        assignedIds
      ),
      selectInChunks<RcRow>(
        'reservation_customers',
        'reservation_id, order_index, name, name_en, name_ko',
        'reservation_id',
        assignedIds
      ),
      selectInChunks<{
        reservation_id: string
        signature_id: string | null
        guide_name: string | null
        guide_phone: string | null
      }>('waiver_guide_signatures', 'reservation_id, signature_id, guide_name, guide_phone', 'reservation_id', assignedIds),
      selectInChunks<{ id: string; reservation_id: string }>(
        'waiver_submissions',
        'id, reservation_id',
        'reservation_id',
        assignedIds
      ),
    ])

  const reservations = rawReservations.filter(
    (r) => !isReservationCancelledStatus(r.status) && !isReservationDeletedStatus(r.status)
  )

  const empty: CanyonWaiverPrintTourPayload = {
    tourId,
    tourDate: tourDateYmd,
    mania: null,
    lower: null,
    canyonX: null,
    canyonKeysByReservationId: {},
  }
  if (reservations.length === 0) return NextResponse.json(empty)

  const activeIds = reservations.map((r) => r.id)
  const activeIdSet = new Set(activeIds)
  const customerIds = [
    ...new Set(reservations.map((r) => r.customer_id).filter((id): id is string => Boolean(id))),
  ]
  const signedAcceptances = acceptances.filter(
    (a) => activeIdSet.has(a.reservation_id) && String(a.status ?? '').toLowerCase() === 'signed'
  )
  const needsGuardian = participants.some(
    (p) => activeIdSet.has(p.reservation_id) && p.participant_type === 'MINOR'
  )
  const submissionIds = needsGuardian
    ? submissions.filter((s) => activeIdSet.has(s.reservation_id)).map((s) => s.id)
    : []
  const earlySigIds = [
    ...new Set(
      [
        ...signedAcceptances.map((a) => a.signature_id),
        ...guideSigRows.map((g) => g.signature_id),
      ].filter((id): id is string => Boolean(id))
    ),
  ]

  const [customers, canyonRowsByResId, guardians, earlySignatureRows] = await Promise.all([
    selectInChunks<{ id: string; name: string | null; language: string | null }>(
      'customers',
      'id, name, language',
      'id',
      customerIds
    ),
    loadCalendarChoiceRows(
      supabaseAdmin,
      reservations.map((r) => ({
        id: r.id,
        canyon_choice: r.canyon_choice ?? null,
        choices: r.choices,
      }))
    ),
    submissionIds.length
      ? selectInChunks<{
          submission_id: string
          guardian_full_legal_name: string | null
          signature_id: string | null
          minor_participant_ids: string[] | null
        }>(
          'waiver_guardian_authorizations',
          'submission_id, guardian_full_legal_name, signature_id, minor_participant_ids',
          'submission_id',
          submissionIds
        )
      : Promise.resolve([]),
    earlySigIds.length
      ? selectInChunks<{ id: string; storage_key: string }>('waiver_signatures', 'id, storage_key', 'id', earlySigIds)
      : Promise.resolve([]),
  ])

  const rezByCanyon: Record<CanyonPrintKey, RezRow[]> = { X: [], L: [] }
  const canyonKeysByReservationId: Record<string, CanyonPrintKey[]> = {}
  for (const rez of reservations) {
    const keys = canyonKeysOf(canyonRowsByResId.get(rez.id))
    canyonKeysByReservationId[rez.id] = keys
    for (const key of keys) rezByCanyon[key].push(rez)
  }
  const ticketMap = new Map<string, TicketRow>()
  for (const ticket of [...ticketsByTour, ...ticketsByRes]) {
    if (!isActiveTicket(ticket)) continue
    const key = `${ticket.id ?? ''}-${ticket.reservation_id ?? ''}-${ticket.rn_number ?? ''}-${ticket.time ?? ''}`
    ticketMap.set(key, ticket)
  }
  const tickets = [...ticketMap.values()]

  const participantsByRes = new Map<string, ParticipantRow[]>()
  for (const p of participants) {
    if (!activeIdSet.has(p.reservation_id)) continue
    const list = participantsByRes.get(p.reservation_id) || []
    list.push(p)
    participantsByRes.set(p.reservation_id, list)
  }
  for (const list of participantsByRes.values()) {
    list.sort((a, b) => a.slot_index - b.slot_index)
  }

  const acceptByParticipant = new Map<string, AcceptanceRow[]>()
  for (const a of signedAcceptances) {
    if (!activeIdSet.has(a.reservation_id)) continue
    const list = acceptByParticipant.get(a.participant_id) || []
    list.push(a)
    acceptByParticipant.set(a.participant_id, list)
  }

  const guardianByParticipant = new Map<
    string,
    { name: string | null; signatureId: string | null }
  >()
  for (const g of guardians) {
    for (const pid of g.minor_participant_ids ?? []) {
      guardianByParticipant.set(pid, {
        name: g.guardian_full_legal_name,
        signatureId: g.signature_id,
      })
    }
  }

  function signatureIdForParticipant(participant: ParticipantRow, canyon: CanyonPrintKey): string | null {
    const rows = acceptByParticipant.get(participant.id) || []
    const canyonCode = canyon === 'X' ? 'ANTELOPE_CANYON_X' : 'LOWER_ANTELOPE'
    const canyonAcc = rows.find((a) => a.document_code === canyonCode)
    const maniaAcc = rows.find((a) => a.document_code === 'LAS_VEGAS_MANIA')
    const guardian = guardianByParticipant.get(participant.id)
    return pickReusableWaiverSignature({
      canyonSignatureUrl: canyonAcc?.signature_id ?? null,
      maniaSignatureUrl: maniaAcc?.signature_id ?? null,
      guardianSignatureUrl: guardian?.signatureId ?? null,
      isMinor: participant.participant_type === 'MINOR',
    })
  }

  function maniaSignatureIdForParticipant(participant: ParticipantRow): string | null {
    const rows = acceptByParticipant.get(participant.id) || []
    const maniaAcc = rows.find((a) => a.document_code === 'LAS_VEGAS_MANIA')
    const guardian = guardianByParticipant.get(participant.id)
    return pickReusableWaiverSignature({
      canyonSignatureUrl: null,
      maniaSignatureUrl: maniaAcc?.signature_id ?? null,
      guardianSignatureUrl: guardian?.signatureId ?? null,
      isMinor: participant.participant_type === 'MINOR',
    })
  }

  const neededSigIds = new Set<string>()
  for (const rez of reservations) {
    for (const participant of participantsByRes.get(rez.id) || []) {
      const id = maniaSignatureIdForParticipant(participant)
      if (id) neededSigIds.add(id)
    }
  }
  for (const canyon of ['L', 'X'] as const) {
    for (const rez of rezByCanyon[canyon]) {
      for (const participant of participantsByRes.get(rez.id) || []) {
        const id = signatureIdForParticipant(participant, canyon)
        if (id) neededSigIds.add(id)
      }
    }
  }
  for (const g of guideSigRows) {
    if (g.signature_id) neededSigIds.add(g.signature_id)
  }

  const signatureById = new Map(earlySignatureRows.map((row) => [row.id, row]))
  const extraSigIds = [...neededSigIds].filter((id) => !signatureById.has(id))
  const extraSignatureRows = extraSigIds.length
    ? await selectInChunks<{ id: string; storage_key: string }>(
        'waiver_signatures',
        'id, storage_key',
        'id',
        extraSigIds
      )
    : []
  for (const row of extraSignatureRows) signatureById.set(row.id, row)
  const signatureRows = [...neededSigIds]
    .map((id) => signatureById.get(id))
    .filter((row): row is { id: string; storage_key: string } => Boolean(row))
  const signatureUrls = await signedUrlsForSignatures(signatureRows)

  const customerById = new Map(customers.map((c) => [c.id, c]))

  const rcByRes = new Map<string, RcRow[]>()
  for (const row of rcRows) {
    if (!activeIdSet.has(row.reservation_id)) continue
    const list = rcByRes.get(row.reservation_id) || []
    list.push(row)
    rcByRes.set(row.reservation_id, list)
  }
  for (const list of rcByRes.values()) {
    list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  }

  function partyGuestsForReservation(
    rez: RezRow,
    signatureIdOf: (participant: ParticipantRow) => string | null
  ) {
    const customer = rez.customer_id ? customerById.get(rez.customer_id) : undefined
    const country = countryFromCustomerLanguage(customer?.language)
    const slots = participantsByRes.get(rez.id) || []
    const rcs = rcByRes.get(rez.id) || []
    const tourDate = String(rez.tour_date || tourDateYmd)
    const size = partySize(rez)
    if (slots.length === 0) {
      const leadRc = rcs[0] || null
      return buildLeadCompanionRoster({
        reservationId: rez.id,
        partySize: size,
        leadName: pickEnglishPrintName({
          nameEn: leadRc?.name_en ?? null,
          name: leadRc?.name || leadRc?.name_ko || customer?.name || null,
        }),
      }).map((guest, index) => ({ ...guest, country: index === 0 ? country : '' }))
    }
    const rcForSlot = (slotIndex: number | undefined, allowLeadFallback: boolean) =>
      rcs.find((row) => (row.order_index ?? -1) === slotIndex) || (allowLeadFallback ? rcs[0] || null : null)
    const leadSlot = slots[0]
    const leadRc = rcForSlot(leadSlot?.slot_index, true)
    const leadPrintName = pickEnglishPrintName({
      fullLegalName: leadSlot?.full_legal_name,
      nameEn: leadRc?.name_en ?? null,
      name: leadRc?.name || leadRc?.name_ko || customer?.name || null,
      placeholder: leadSlot?.placeholder_label,
    })
    const guests = slots.map((slot, index) => {
      const isLead = index === 0
      const rc = rcForSlot(slot.slot_index, isLead)
      const guardian = guardianByParticipant.get(slot.id)
      const sigId = signatureIdOf(slot)
      const printName = printNameForPartySlot({
        isLead,
        hasSignature: Boolean(sigId),
        leadPrintName,
        fullLegalName: slot.full_legal_name,
        nameEn: rc?.name_en ?? null,
        name: isLead ? rc?.name || rc?.name_ko || customer?.name || null : rc?.name || rc?.name_ko || null,
        placeholder: slot.placeholder_label,
      })
      return {
        id: slot.id,
        reservationId: rez.id,
        printName,
        signatureUrl: printName && sigId ? signatureUrls[sigId] ?? null : null,
        country: isLead || printName ? country : '',
        receiptNumber: printName ? String(rez.channel_rn || '').trim() : '',
        isMinor: slot.participant_type === 'MINOR',
        age: ageOnTourDate(slot.date_of_birth, tourDate),
        guardianName: guardian?.name ?? null,
      }
    })
    while (guests.length < size) {
      guests.push({
        id: `${rez.id}:companion:${guests.length}`,
        reservationId: rez.id,
        printName: '',
        signatureUrl: null,
        country: '',
        receiptNumber: '',
        isMinor: false,
        age: null,
        guardianName: null,
      })
    }
    return guests
  }

  function guestsForReservation(rez: RezRow, canyon: CanyonPrintKey) {
    return partyGuestsForReservation(rez, (participant) => signatureIdForParticipant(participant, canyon))
  }

  function maniaGuestsForReservation(rez: RezRow) {
    return partyGuestsForReservation(rez, maniaSignatureIdForParticipant)
  }

  let guideName = String(
    teamMember?.name_en || teamMember?.nick_name || teamMember?.name_ko || guideEmail || ''
  )
  let guidePhone = String(teamMember?.phone ?? '')
  const guideSig = guideSigRows.find((g) => g.signature_id)
  const guideSignatureUrl = guideSig?.signature_id ? signatureUrls[guideSig.signature_id] ?? null : null
  if (guideSig?.guide_name) guideName = guideSig.guide_name
  if (guideSig?.guide_phone) guidePhone = guideSig.guide_phone

  function buildManiaPacket(): CanyonWaiverPrintPacket | null {
    const guests = reservations.flatMap((rez) => maniaGuestsForReservation(rez))
    if (guests.length === 0) return null
    const counts = reservations.reduce(
      (acc, rez) => {
        const party = partyAdultsMinors(rez)
        acc.adults += party.adults
        acc.minors += party.minors
        return acc
      },
      { adults: 0, minors: 0 }
    )
    return {
      canyon: 'M',
      companyName: CANYON_WAIVER_COMPANY_NAME,
      date: formatCanyonFormDate(tourDateYmd),
      tourTime: formatCanyonFormTime(modeValue(reservations.map((r) => r.tour_time))),
      adultCount: counts.adults,
      minorCount: counts.minors,
      guideName,
      guidePhone,
      guideSignatureUrl: null,
      guests,
    }
  }

  function buildPacket(canyon: CanyonPrintKey, rezList: RezRow[]): CanyonWaiverPrintPacket | null {
    const guests = rezList.flatMap((rez) => guestsForReservation(rez, canyon))
    if (guests.length === 0) return null
    const canyonTickets = tickets.filter((t) => ticketBookingCanyonKeyFromBooking(t) === canyon)
    const dateRaw =
      modeValue(canyonTickets.map((t) => t.check_in_date)) ||
      antelopeCheckInYmd ||
      tourDateYmd
    const timeRaw =
      modeValue(canyonTickets.map((t) => t.time)) ||
      modeValue(rezList.map((r) => r.tour_time))
    const counts = rezList.reduce(
      (acc, rez) => {
        const party = partyAdultsMinors(rez)
        acc.adults += party.adults
        acc.minors += party.minors
        return acc
      },
      { adults: 0, minors: 0 }
    )
    return {
      canyon,
      companyName: CANYON_WAIVER_COMPANY_NAME,
      date: formatCanyonFormDate(dateRaw),
      tourTime: formatCanyonFormTime(timeRaw),
      adultCount: counts.adults,
      minorCount: counts.minors,
      guideName,
      guidePhone,
      guideSignatureUrl: canyon === 'X' ? guideSignatureUrl : null,
      guests,
    }
  }

  return NextResponse.json({
    tourId,
    tourDate: tourDateYmd,
    mania: buildManiaPacket(),
    lower: buildPacket('L', rezByCanyon.L),
    canyonX: buildPacket('X', rezByCanyon.X),
    canyonKeysByReservationId,
  } satisfies CanyonWaiverPrintTourPayload)
}
