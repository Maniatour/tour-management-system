import { supabase } from '@/lib/supabase'
import { todayInLasVegas, tomorrowInLasVegas } from '@/lib/dailyReport/dateUtils'
import { isGoblinTourProduct, shouldAttachOvernightGoblinPlayback } from '@/lib/goblinTour'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import {
  deletePendingNarrationPlay,
  enqueuePendingNarrationPlay,
  isBrowserOffline,
  listPendingNarrationPlays,
  loadGuideSnapshot,
  saveGuideSnapshot,
} from '@/lib/guideOfflineStore'

export type NarrationPlayRole = 'guide' | 'assistant' | 'driver'

export type TourNarrationPlay = {
  id: string
  tour_id: string
  material_id: string
  material_title: string
  file_path: string
  played_by_email: string
  played_as: NarrationPlayRole
  first_played_at: string
  last_played_at: string
  play_count: number
  play_seconds: number
  played_by_name?: string | null
}

type AssignedTour = {
  id: string
  tour_guide_id: string | null
  assistant_id: string | null
  tour_date?: string | null
  product_id?: string | null
  products?: unknown
}

function firstProduct(value: unknown): {
  id?: string | null
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
} | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object' ? (first as { id?: string | null; name?: string | null; name_ko?: string | null; name_en?: string | null }) : null
  }
  if (typeof value === 'object') {
    return value as { id?: string | null; name?: string | null; name_ko?: string | null; name_en?: string | null }
  }
  return null
}

export function formatNarrationDuration(totalSeconds: number, locale: string): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (locale === 'en') {
    if (minutes <= 0) return `${rest}s`
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`
  }
  if (minutes <= 0) return `${rest}초`
  return rest > 0 ? `${minutes}분 ${rest}초` : `${minutes}분`
}

export function narrationRoleLabel(role: NarrationPlayRole, locale: string): string {
  if (locale === 'en') {
    if (role === 'assistant') return 'Assistant'
    if (role === 'driver') return 'Driver'
    return 'Guide'
  }
  if (role === 'assistant') return '어시스턴트'
  if (role === 'driver') return '드라이버'
  return '가이드'
}

function normalizeEmail(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

export function narrationRoleFromPosition(
  position: string | null | undefined,
  tour: AssignedTour,
  email: string,
): NarrationPlayRole {
  const pos = (position || '').trim().toLowerCase()
  if (pos.includes('driver')) return 'driver'
  if (normalizeEmail(tour.assistant_id) === normalizeEmail(email)) return 'assistant'
  if (pos.includes('assist')) return 'assistant'
  return 'guide'
}

const ASSIGNED_TOURS_SNAPSHOT_KEY = 'guide:today-assigned-tours'

type TodayAssignment = {
  tours: AssignedTour[]
  position: string | null
}

function parseAssignmentSnapshot(snap: unknown): TodayAssignment {
  if (Array.isArray(snap)) {
    return { tours: snap as AssignedTour[], position: null }
  }
  if (snap && typeof snap === 'object' && Array.isArray((snap as { tours?: unknown }).tours)) {
    const obj = snap as { tours: AssignedTour[]; position?: string | null }
    return { tours: obj.tours, position: obj.position ?? null }
  }
  return { tours: [], position: null }
}

function filterOrForEmail(email: string): string {
  const raw = (email || '').trim().replace(/"/g, '')
  const lower = raw.toLowerCase()
  if (raw && raw !== lower) {
    return `tour_guide_id.eq."${raw}",assistant_id.eq."${raw}",tour_guide_id.eq."${lower}",assistant_id.eq."${lower}"`
  }
  return `tour_guide_id.eq."${lower}",assistant_id.eq."${lower}"`
}

async function loadStaffPosition(email: string): Promise<string | null> {
  const raw = (email || '').trim().replace(/"/g, '')
  const lower = raw.toLowerCase()
  const orFilter =
    raw && raw !== lower ? `email.eq."${raw}",email.eq."${lower}"` : `email.eq."${lower}"`
  const { data } = await supabase.from('team').select('position').or(orFilter).limit(1).maybeSingle()
  return (data as { position?: string | null } | null)?.position ?? null
}

async function loadTodayAssignment(email: string): Promise<TodayAssignment> {
  const today = todayInLasVegas()
  if (isBrowserOffline()) {
    return parseAssignmentSnapshot(await loadGuideSnapshot(ASSIGNED_TOURS_SNAPSHOT_KEY))
  }
  const dates = shouldAttachOvernightGoblinPlayback()
    ? [today, tomorrowInLasVegas(today)]
    : [today]
  const { data, error } = await supabase
    .from('tours')
    .select('id, tour_guide_id, assistant_id, tour_date, product_id, products(id, name, name_ko, name_en)')
    .in('tour_date', dates)
    .or(filterOrForEmail(email))

  if (error) {
    console.warn('[narration play] assigned tours', error)
    return parseAssignmentSnapshot(await loadGuideSnapshot(ASSIGNED_TOURS_SNAPSHOT_KEY))
  }
  const em = normalizeEmail(email)
  const includeOvernightGoblin = dates.length > 1
  const tours = ((data || []) as AssignedTour[]).filter((tour) => {
    if (normalizeEmail(tour.tour_guide_id) !== em && normalizeEmail(tour.assistant_id) !== em) {
      return false
    }
    const tourDate = String(tour.tour_date || '')
    if (tourDate === today) return true
    if (!includeOvernightGoblin || tourDate !== dates[1]) return false
    return isGoblinTourProduct(firstProduct(tour.products), tour.product_id)
  })
  const position = await loadStaffPosition(email)
  const assignment = { tours, position }
  void saveGuideSnapshot(ASSIGNED_TOURS_SNAPSHOT_KEY, assignment)
  return assignment
}

async function loadAssignedToursToday(email: string): Promise<AssignedTour[]> {
  const { tours } = await loadTodayAssignment(email)
  return tours
}

async function rpcRecordPlay(args: {
  tourId: string
  materialId: string
  materialTitle: string
  filePath: string
  playedAs: NarrationPlayRole
  playSeconds: number
  newSession: boolean
}): Promise<boolean> {
  const { error } = await supabase.rpc('record_tour_narration_play', {
    p_tour_id: args.tourId,
    p_material_id: args.materialId,
    p_material_title: args.materialTitle,
    p_file_path: args.filePath,
    p_played_as: args.playedAs,
    p_play_seconds: args.playSeconds,
    p_new_session: args.newSession,
  })
  if (error) {
    console.warn('[narration play] rpc', error)
    return false
  }
  return true
}

export async function recordNarrationPlayback(input: {
  email: string
  materialId: string
  materialTitle: string
  filePath: string
  playSeconds?: number
  newSession?: boolean
}): Promise<void> {
  const email = normalizeEmail(input.email)
  if (!email || !input.materialId) return

  const playSeconds = Math.max(0, Math.round(input.playSeconds ?? 0))
  const newSession = input.newSession !== false

  if (isBrowserOffline()) {
    const { tours, position } = await loadTodayAssignment(email)
    if (tours.length === 0) {
      await enqueuePendingNarrationPlay({
        id: crypto.randomUUID(),
        tourId: '',
        materialId: input.materialId,
        materialTitle: input.materialTitle,
        filePath: input.filePath,
        playedAs: 'guide',
        playSeconds,
        newSession,
        createdAt: Date.now(),
      })
      return
    }
    for (const tour of tours) {
      await enqueuePendingNarrationPlay({
        id: crypto.randomUUID(),
        tourId: tour.id,
        materialId: input.materialId,
        materialTitle: input.materialTitle,
        filePath: input.filePath,
        playedAs: narrationRoleFromPosition(position, tour, email),
        playSeconds,
        newSession,
        createdAt: Date.now(),
      })
    }
    return
  }

  const { tours, position } = await loadTodayAssignment(email)
  if (tours.length === 0) return
  for (const tour of tours) {
    const ok = await rpcRecordPlay({
      tourId: tour.id,
      materialId: input.materialId,
      materialTitle: input.materialTitle,
      filePath: input.filePath,
      playedAs: narrationRoleFromPosition(position, tour, email),
      playSeconds,
      newSession,
    })
    if (!ok) {
      await enqueuePendingNarrationPlay({
        id: crypto.randomUUID(),
        tourId: tour.id,
        materialId: input.materialId,
        materialTitle: input.materialTitle,
        filePath: input.filePath,
        playedAs: narrationRoleFromPosition(position, tour, email),
        playSeconds,
        newSession,
        createdAt: Date.now(),
      })
    }
  }
}

export async function prefetchAssignedToursForNarrationLog(email: string): Promise<void> {
  if (!email || isBrowserOffline()) return
  await loadTodayAssignment(email)
}

export async function flushPendingNarrationPlays(email: string): Promise<void> {
  if (!email || isBrowserOffline()) return
  const pending = await listPendingNarrationPlays()
  if (pending.length === 0) return

  const { tours, position } = await loadTodayAssignment(email)

  for (const item of pending) {
    const targetTours = item.tourId
      ? [{ id: item.tourId, tour_guide_id: email, assistant_id: null }]
      : tours
    if (targetTours.length === 0) continue
    let allOk = true
    for (const tour of targetTours) {
      const ok = await rpcRecordPlay({
        tourId: tour.id,
        materialId: item.materialId,
        materialTitle: item.materialTitle,
        filePath: item.filePath,
        playedAs: item.playedAs || narrationRoleFromPosition(position, tour, email),
        playSeconds: item.playSeconds,
        newSession: item.newSession,
      })
      if (!ok) allOk = false
    }
    if (allOk) await deletePendingNarrationPlay(item.id)
  }
}

export async function getTodayAssignedTourIds(email: string): Promise<string[]> {
  const tours = await loadAssignedToursToday(email)
  return tours.map((tour) => tour.id)
}

async function loadTeamNames(emails: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(emails.map((value) => value.trim()).filter(Boolean))]
  const nameByEmail = new Map<string, string>()
  if (unique.length === 0) return nameByEmail

  const orFilter = unique
    .map((value) => {
      const raw = value.replace(/"/g, '')
      const lower = raw.toLowerCase()
      return raw !== lower ? `email.eq."${raw}",email.eq."${lower}"` : `email.eq."${lower}"`
    })
    .join(',')
  const { data: teamRows } = await supabase
    .from('team')
    .select('email, nick_name, name_ko, name_en, display_name')
    .or(orFilter)

  for (const member of teamRows || []) {
    const row = member as {
      email: string
      nick_name?: string | null
      name_ko?: string | null
      name_en?: string | null
      display_name?: string | null
    }
    const name = row.nick_name || row.display_name || row.name_ko || row.name_en || row.email
    nameByEmail.set(normalizeEmail(row.email), name)
  }
  return nameByEmail
}

async function withPlayedByNames(rows: TourNarrationPlay[]): Promise<TourNarrationPlay[]> {
  const emails = [...new Set(rows.map((row) => row.played_by_email).filter(Boolean))]
  if (emails.length === 0) return rows
  const nameByEmail = await loadTeamNames(emails)
  return rows.map((row) => ({
    ...row,
    played_by_name: nameByEmail.get(normalizeEmail(row.played_by_email)) || row.played_by_email,
  }))
}

const PLAY_COLUMNS =
  'id, tour_id, material_id, material_title, file_path, played_by_email, played_as, first_played_at, last_played_at, play_count, play_seconds'

export async function fetchTourNarrationPlays(tourId: string): Promise<TourNarrationPlay[]> {
  const { data, error } = await supabase
    .from('tour_narration_plays')
    .select(PLAY_COLUMNS)
    .eq('tour_id', tourId)
    .order('last_played_at', { ascending: false })

  if (error) {
    console.warn('[narration play] fetch', error)
    return []
  }

  return withPlayedByNames((data || []) as TourNarrationPlay[])
}

export async function fetchTourNarrationPlaysForTourIds(
  tourIds: string[],
): Promise<TourNarrationPlay[]> {
  const ids = [...new Set(tourIds.filter(Boolean))]
  if (ids.length === 0) return []
  const rows: TourNarrationPlay[] = []
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80)
    const { data, error } = await supabase
      .from('tour_narration_plays')
      .select(PLAY_COLUMNS)
      .in('tour_id', chunk)
      .order('last_played_at', { ascending: false })
    if (error) {
      console.warn('[narration play] fetch many', error)
      continue
    }
    rows.push(...((data || []) as TourNarrationPlay[]))
  }
  return withPlayedByNames(rows)
}

export type TourNarrationHistoryRow = {
  tourId: string
  tourDate: string
  productName: string
  productId: string | null
  isGoblin: boolean
  tourStatus: string | null
  guideEmail: string | null
  assistantEmail: string | null
  guideName: string | null
  assistantName: string | null
  plays: TourNarrationPlay[]
  played: boolean
}

function productDisplayName(
  product: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null,
  locale: string,
): string {
  if (!product) return ''
  if (locale === 'en') return product.name_en || product.name || product.name_ko || ''
  return product.name_ko || product.name || product.name_en || ''
}

export async function fetchToursNarrationHistory(args: {
  startDate?: string | undefined
  endDate?: string | undefined
  tourId?: string | null | undefined
  operatorId?: string | null | undefined
  goblinOnly?: boolean
  locale?: string
}): Promise<TourNarrationHistoryRow[]> {
  const locale = args.locale === 'en' ? 'en' : 'ko'
  let query = supabase
    .from('tours')
    .select(
      'id, tour_date, tour_status, product_id, tour_guide_id, assistant_id, products(id, name, name_ko, name_en)',
    )
    .eq('operator_id', resolveOperatorId(args.operatorId))
    .order('tour_date', { ascending: false })
    .order('id', { ascending: true })

  if (args.tourId) {
    query = query.eq('id', args.tourId)
  } else {
    if (args.startDate) query = query.gte('tour_date', args.startDate)
    if (args.endDate) query = query.lte('tour_date', args.endDate)
  }

  const { data, error } = await query.limit(800)
  if (error) {
    console.warn('[narration play] history tours', error)
    return []
  }

  const tours = (data || [])
    .map((row) => {
      const tour = row as {
        id: string
        tour_date: string | null
        tour_status: string | null
        product_id: string | null
        tour_guide_id: string | null
        assistant_id: string | null
        products: unknown
      }
      return {
        ...tour,
        product: firstProduct(tour.products),
      }
    })
    .filter((tour) => !isTourCancelled(tour.tour_status))
    .filter((tour) =>
      args.goblinOnly ? isGoblinTourProduct(tour.product, tour.product_id) : true,
    )

  const plays = await fetchTourNarrationPlaysForTourIds(tours.map((tour) => tour.id))
  const playsByTour = new Map<string, TourNarrationPlay[]>()
  for (const play of plays) {
    const list = playsByTour.get(play.tour_id) || []
    list.push(play)
    playsByTour.set(play.tour_id, list)
  }

  const staffEmails = tours.flatMap((tour) => [tour.tour_guide_id, tour.assistant_id]).filter(Boolean) as string[]
  const nameByEmail = await loadTeamNames(staffEmails)

  return tours.map((tour) => {
    const tourPlays = playsByTour.get(tour.id) || []
    return {
      tourId: tour.id,
      tourDate: tour.tour_date || '',
      productName: productDisplayName(tour.product, locale) || tour.product_id || tour.id,
      productId: tour.product_id,
      isGoblin: isGoblinTourProduct(tour.product, tour.product_id),
      tourStatus: tour.tour_status,
      guideEmail: tour.tour_guide_id,
      assistantEmail: tour.assistant_id,
      guideName: tour.tour_guide_id
        ? nameByEmail.get(normalizeEmail(tour.tour_guide_id)) || tour.tour_guide_id
        : null,
      assistantName: tour.assistant_id
        ? nameByEmail.get(normalizeEmail(tour.assistant_id)) || tour.assistant_id
        : null,
      plays: tourPlays,
      played: tourPlays.length > 0,
    }
  })
}
