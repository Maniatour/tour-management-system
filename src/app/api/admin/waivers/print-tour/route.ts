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
  pickEnglishPrintName,
  pickReusableWaiverSignature,
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
  if (!supabaseAdmin || ids.length === 0) return []
  const out: T[] = []
  for (const chunk of chunkStrings(ids)) {
    const { data, error } = await fromUntypedTable(supabaseAdmin, table)
      .select(columns)
      .in(column, chunk)
    if (error) {
      console.warn(`[print-tour] ${table}`, error.message)
      continue
    }
    if (data?.length) out.push(...(data as T[]))
  }
  return out
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
  const reservations = (await selectInChunks<RezRow>(
    'reservations',
    'id, customer_id, channel_rn, tour_date, tour_time, product_id, canyon_choice, choices, adults, child, infant, total_people, status',
    'id',
    assignedIds
  )).filter((r) => !isReservationCancelledStatus(r.status) && !isReservationDeletedStatus(r.status))

  const empty: CanyonWaiverPrintTourPayload = {
    tourId,
    tourDate: tourDateYmd,
    lower: null,
    canyonX: null,
  }
  if (reservations.length === 0) return NextResponse.json(empty)

  const canyonRowsByResId = await loadCalendarChoiceRows(
    supabaseAdmin,
    reservations.map((r) => ({
      id: r.id,
      canyon_choice: r.canyon_choice ?? null,
      choices: r.choices,
    }))
  )

  const rezByCanyon: Record<CanyonPrintKey, RezRow[]> = { X: [], L: [] }
  for (const rez of reservations) {
    for (const key of canyonKeysOf(canyonRowsByResId.get(rez.id))) {
      rezByCanyon[key].push(rez)
    }
  }
  const relevant = [...new Map([...rezByCanyon.X, ...rezByCanyon.L].map((r) => [r.id, r])).values()]
  const relevantIds = relevant.map((r) => r.id)
  if (relevantIds.length === 0) return NextResponse.json(empty)

  const [participants, acceptances, rcRows, ticketsByTour, ticketsByRes, guideSigRows] = await Promise.all([
    selectInChunks<ParticipantRow>(
      'waiver_participants',
      'id, reservation_id, slot_index, full_legal_name, placeholder_label, participant_type, date_of_birth',
      'reservation_id',
      relevantIds
    ),
    selectInChunks<AcceptanceRow>(
      'waiver_acceptances',
      'participant_id, reservation_id, document_code, signature_id, status',
      'reservation_id',
      relevantIds
    ),
    selectInChunks<RcRow>(
      'reservation_customers',
      'reservation_id, order_index, name, name_en, name_ko',
      'reservation_id',
      relevantIds
    ),
    fromUntypedTable(supabaseAdmin, 'ticket_bookings')
      .select(
        'id, reservation_id, tour_id, company, category, check_in_date, time, rn_number, vendor_confirmation_number, invoice_number, status, booking_status'
      )
      .eq('tour_id', tourId)
      .then((res) => (res.data ?? []) as TicketRow[]),
    selectInChunks<TicketRow>(
      'ticket_bookings',
      'id, reservation_id, tour_id, company, category, check_in_date, time, rn_number, vendor_confirmation_number, invoice_number, status, booking_status',
      'reservation_id',
      relevantIds
    ),
    selectInChunks<{ reservation_id: string; signature_id: string | null; guide_name: string | null; guide_phone: string | null }>(
      'waiver_guide_signatures',
      'reservation_id, signature_id, guide_name, guide_phone',
      'reservation_id',
      rezByCanyon.X.map((r) => r.id)
    ),
  ])

  const ticketMap = new Map<string, TicketRow>()
  for (const ticket of [...ticketsByTour, ...ticketsByRes]) {
    if (!isActiveTicket(ticket)) continue
    const key = `${ticket.id ?? ''}-${ticket.reservation_id ?? ''}-${ticket.rn_number ?? ''}-${ticket.time ?? ''}`
    ticketMap.set(key, ticket)
  }
  const tickets = [...ticketMap.values()]

  const signedAcceptances = acceptances.filter((a) => String(a.status ?? '').toLowerCase() === 'signed')
  const sigIds = [
    ...new Set(
      [
        ...signedAcceptances.map((a) => a.signature_id).filter(Boolean),
        ...guideSigRows.map((g) => g.signature_id).filter(Boolean),
      ] as string[]
    ),
  ]

  const submissions = await selectInChunks<{ id: string; reservation_id: string }>(
    'waiver_submissions',
    'id, reservation_id',
    'reservation_id',
    relevantIds
  )
  const submissionIds = submissions.map((s) => s.id)
  const guardians = submissionIds.length
    ? await selectInChunks<{
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
    : []
  for (const g of guardians) {
    if (g.signature_id) sigIds.push(g.signature_id)
  }

  const uniqueSigIds = [...new Set(sigIds.filter(Boolean))]
  const signatureRows = uniqueSigIds.length
    ? await selectInChunks<{ id: string; storage_key: string }>(
        'waiver_signatures',
        'id, storage_key',
        'id',
        uniqueSigIds
      )
    : []
  const signatureUrls: Record<string, string> = {}
  await Promise.all(
    signatureRows.map(async (sig) => {
      const { data } = await supabaseAdmin!.storage.from('waiver-signatures').createSignedUrl(sig.storage_key, 60 * 60)
      if (data?.signedUrl) signatureUrls[sig.id] = data.signedUrl
    })
  )

  const customerIds = [
    ...new Set(reservations.map((r) => r.customer_id).filter((id): id is string => Boolean(id))),
  ]
  const customers = await selectInChunks<{ id: string; name: string | null; language: string | null }>(
    'customers',
    'id, name, language',
    'id',
    customerIds
  )
  const customerById = new Map(customers.map((c) => [c.id, c]))

  const participantsByRes = new Map<string, ParticipantRow[]>()
  for (const p of participants) {
    const list = participantsByRes.get(p.reservation_id) || []
    list.push(p)
    participantsByRes.set(p.reservation_id, list)
  }
  for (const list of participantsByRes.values()) {
    list.sort((a, b) => a.slot_index - b.slot_index)
  }

  const rcByRes = new Map<string, RcRow[]>()
  for (const row of rcRows) {
    const list = rcByRes.get(row.reservation_id) || []
    list.push(row)
    rcByRes.set(row.reservation_id, list)
  }
  for (const list of rcByRes.values()) {
    list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  }

  const acceptByParticipant = new Map<string, AcceptanceRow[]>()
  for (const a of signedAcceptances) {
    const list = acceptByParticipant.get(a.participant_id) || []
    list.push(a)
    acceptByParticipant.set(a.participant_id, list)
  }

  const guardianByParticipant = new Map<
    string,
    { name: string | null; signatureUrl: string | null }
  >()
  for (const g of guardians) {
    for (const pid of g.minor_participant_ids ?? []) {
      guardianByParticipant.set(pid, {
        name: g.guardian_full_legal_name,
        signatureUrl: g.signature_id ? signatureUrls[g.signature_id] ?? null : null,
      })
    }
  }

  function signatureForParticipant(participant: ParticipantRow, canyon: CanyonPrintKey): string | null {
    const rows = acceptByParticipant.get(participant.id) || []
    const canyonCode = canyon === 'X' ? 'ANTELOPE_CANYON_X' : 'LOWER_ANTELOPE'
    const canyonAcc = rows.find((a) => a.document_code === canyonCode)
    const maniaAcc = rows.find((a) => a.document_code === 'LAS_VEGAS_MANIA')
    const guardian = guardianByParticipant.get(participant.id)
    return pickReusableWaiverSignature({
      canyonSignatureUrl: canyonAcc?.signature_id ? signatureUrls[canyonAcc.signature_id] ?? null : null,
      maniaSignatureUrl: maniaAcc?.signature_id ? signatureUrls[maniaAcc.signature_id] ?? null : null,
      guardianSignatureUrl: guardian?.signatureUrl ?? null,
      isMinor: participant.participant_type === 'MINOR',
    })
  }

  function guestsForReservation(rez: RezRow, canyon: CanyonPrintKey) {
    const customer = rez.customer_id ? customerById.get(rez.customer_id) : undefined
    const slots = participantsByRes.get(rez.id) || []
    const rcs = rcByRes.get(rez.id) || []
    const tourDate = String(rez.tour_date || tourDateYmd)
    const leadSlot = slots[0] ?? null
    const leadRc = (leadSlot ? rcs[leadSlot.slot_index] : null) || rcs[0] || null
    const guardian = leadSlot ? guardianByParticipant.get(leadSlot.id) : undefined
    return buildLeadCompanionRoster({
      reservationId: rez.id,
      partySize: partySize(rez),
      leadId: leadSlot?.id,
      leadName: pickEnglishPrintName({
        fullLegalName: leadSlot?.full_legal_name,
        nameEn: leadRc?.name_en ?? null,
        name: leadRc?.name || leadRc?.name_ko || customer?.name || null,
      }),
      leadSignatureUrl: leadSlot ? signatureForParticipant(leadSlot, canyon) : null,
      leadIsMinor: leadSlot?.participant_type === 'MINOR',
      leadAge: ageOnTourDate(leadSlot?.date_of_birth, tourDate),
      leadGuardianName: guardian?.name ?? null,
    })
  }

  const guideEmail = parseTourAssignmentEmails(String(tour.tour_guide_id ?? ''))[0]
  let guideName = ''
  let guidePhone = ''
  if (guideEmail) {
    const { data: member } = await fromUntypedTable(supabaseAdmin, 'team')
      .select('name_en, name_ko, nick_name, phone, email')
      .ilike('email', guideEmail)
      .maybeSingle()
    guideName = String(member?.name_en || member?.nick_name || member?.name_ko || guideEmail)
    guidePhone = String(member?.phone ?? '')
  }
  const guideSig = guideSigRows.find((g) => g.signature_id)
  const guideSignatureUrl = guideSig?.signature_id ? signatureUrls[guideSig.signature_id] ?? null : null
  if (guideSig?.guide_name) guideName = guideSig.guide_name
  if (guideSig?.guide_phone) guidePhone = guideSig.guide_phone

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
    lower: buildPacket('L', rezByCanyon.L),
    canyonX: buildPacket('X', rezByCanyon.X),
  } satisfies CanyonWaiverPrintTourPayload)
}
