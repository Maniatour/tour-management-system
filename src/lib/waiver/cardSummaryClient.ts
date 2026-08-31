'use client'

import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { resolveRequiredWaivers, signingRequiredCodes } from '@/lib/waiver/requiredWaivers'
import type { WaiverCardSummary } from '@/lib/waiver/cardSummaryBatch'

type Listener = (row: WaiverCardSummary | null, loaded: boolean) => void

const queue = new Set<string>()
const listeners = new Map<string, Set<Listener>>()
const cache = new Map<string, { at: number; row: WaiverCardSummary | null }>()
let timer: ReturnType<typeof setTimeout> | null = null
let inFlight: Promise<void> | null = null

const CACHE_MS = 60_000
const CHUNK = 80

function notify(id: string, row: WaiverCardSummary | null, loaded: boolean) {
  const set = listeners.get(id)
  if (!set) return
  for (const cb of set) cb(row, loaded)
}

function chunkIds(ids: string[], size: number) {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

function buildRows(input: {
  ids: string[]
  reservations: Array<{
    id: string
    channel_rn: string | null
    tour_date: string
    product_id: string | null
    canyon_choice: string | null
    total_people: number | null
  }>
  participants: Array<{
    id: string
    reservation_id: string
    full_legal_name: string | null
    placeholder_label: string
  }>
  acceptances: Array<{
    participant_id: string
    reservation_id: string
    document_code: string
  }>
}): Map<string, WaiverCardSummary> {
  const reservationById = new Map(input.reservations.map((row) => [row.id, row]))
  const signed = new Map<string, Set<string>>()
  for (const row of input.acceptances) {
    const key = `${row.reservation_id}:${row.participant_id}`
    const set = signed.get(key) ?? new Set<string>()
    set.add(row.document_code)
    signed.set(key, set)
  }
  const peopleByRes = new Map<string, typeof input.participants>()
  for (const person of input.participants) {
    const list = peopleByRes.get(person.reservation_id) ?? []
    list.push(person)
    peopleByRes.set(person.reservation_id, list)
  }

  const out = new Map<string, WaiverCardSummary>()
  for (const id of input.ids) {
    const reservation = reservationById.get(id)
    const required = signingRequiredCodes(
      resolveRequiredWaivers({ canyonChoice: reservation?.canyon_choice ?? null })
    )
    const people = peopleByRes.get(id) ?? []
    const guestCount = people.length || Number(reservation?.total_people ?? 0)
    const participants = people.map((person) => {
      const docs = signed.get(`${id}:${person.id}`) ?? new Set<string>()
      const codes = [...new Set([...required, ...docs])]
      const perDoc = Object.fromEntries(codes.map((code) => [code, docs.has(code)]))
      return {
        id: person.id,
        name: person.full_legal_name || person.placeholder_label,
        perDoc,
        complete: required.every((code) => docs.has(code)),
      }
    })
    const completeGuests = participants.filter((row) => row.complete).length
    out.set(id, {
      reservationId: id,
      bookingNumber: (reservation?.channel_rn || '').trim() || id,
      tourDate: reservation?.tour_date ?? '',
      tourName: 'Tour',
      guestCount,
      required,
      completeGuests,
      overall: guestCount > 0 && completeGuests >= guestCount && required.length > 0 ? 'COMPLETE' : 'INCOMPLETE',
      participants,
    })
  }
  return out
}

async function fetchChunk(ids: string[]): Promise<Map<string, WaiverCardSummary>> {
  const [reservationsRes, participantsRes, acceptancesRes] = await Promise.all([
    fromUntypedTable(supabase, 'reservations')
      .select('id, channel_rn, tour_date, product_id, canyon_choice, total_people')
      .in('id', ids),
    fromUntypedTable(supabase, 'waiver_participants')
      .select('id, reservation_id, full_legal_name, placeholder_label')
      .in('reservation_id', ids),
    fromUntypedTable(supabase, 'waiver_acceptances')
      .select('participant_id, reservation_id, document_code, status')
      .in('reservation_id', ids)
      .eq('status', 'signed'),
  ])

  if (reservationsRes.error) throw reservationsRes.error
  if (participantsRes.error) throw participantsRes.error
  if (acceptancesRes.error) throw acceptancesRes.error

  return buildRows({
    ids,
    reservations: reservationsRes.data ?? [],
    participants: participantsRes.data ?? [],
    acceptances: acceptancesRes.data ?? [],
  })
}

async function flushQueue() {
  const ids = [...queue]
  queue.clear()
  if (!ids.length) return
  try {
    const chunks = chunkIds(ids, CHUNK)
    const maps = await Promise.all(chunks.map((part) => fetchChunk(part)))
    const byId = new Map<string, WaiverCardSummary>()
    for (const map of maps) {
      for (const [id, row] of map) byId.set(id, row)
    }
    const now = Date.now()
    for (const id of ids) {
      const row = byId.get(id) ?? null
      cache.set(id, { at: now, row })
      notify(id, row, true)
    }
  } catch (error) {
    console.error('[waiver card summary]', error)
    for (const id of ids) notify(id, cache.get(id)?.row ?? null, true)
  }
}

function scheduleFlush() {
  if (inFlight || timer) return
  timer = setTimeout(() => {
    timer = null
    inFlight = flushQueue().finally(() => {
      inFlight = null
      if (queue.size) scheduleFlush()
    })
  }, 0)
}

function enqueue(ids: string[], force = false) {
  const now = Date.now()
  for (const id of ids) {
    const trimmed = id.trim()
    if (!trimmed) continue
    const cached = cache.get(trimmed)
    if (!force && cached && now - cached.at < CACHE_MS) continue
    queue.add(trimmed)
  }
  if (queue.size) scheduleFlush()
}

export function prefetchWaiverCardSummaries(reservationIds: string[]) {
  enqueue(reservationIds)
}

export function subscribeWaiverCardSummary(reservationId: string, cb: Listener): () => void {
  const cached = cache.get(reservationId)
  if (cached) cb(cached.row, true)
  else cb(null, false)

  const stale = !cached || Date.now() - cached.at >= CACHE_MS
  if (stale) enqueue([reservationId])

  const set = listeners.get(reservationId) ?? new Set<Listener>()
  set.add(cb)
  listeners.set(reservationId, set)
  return () => {
    set.delete(cb)
    if (set.size === 0) listeners.delete(reservationId)
  }
}

export function invalidateWaiverCardSummary(reservationId: string) {
  cache.delete(reservationId)
  enqueue([reservationId], true)
}

export function applyProductNameToWaiverSummary(
  summary: WaiverCardSummary | null,
  productName: string | undefined,
  totalPeople = 0
): WaiverCardSummary | null {
  if (!summary) return null
  const extra = signingRequiredCodes(resolveRequiredWaivers({ productName: productName || null }))
  const required = [...new Set([...summary.required, ...extra])]
  const participants = summary.participants.map((person) => {
    const perDoc = Object.fromEntries(required.map((code) => [code, Boolean(person.perDoc[code])]))
    return {
      ...person,
      perDoc,
      complete: required.every((code) => person.perDoc[code]),
    }
  })
  const guestCount = participants.length || summary.guestCount || totalPeople
  const completeGuests = participants.filter((person) => person.complete).length
  return {
    ...summary,
    tourName: productName || summary.tourName,
    required,
    participants,
    guestCount,
    completeGuests,
    overall: guestCount > 0 && completeGuests >= guestCount && required.length > 0 ? 'COMPLETE' : 'INCOMPLETE',
  }
}
