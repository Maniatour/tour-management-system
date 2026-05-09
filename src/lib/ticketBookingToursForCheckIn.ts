/**
 * 입장권 부킹 체크인일 기준 투어 후보 목록 (TicketBookingForm과 동일 규칙).
 */

import { isTourCancelled } from '@/utils/tourStatusUtils'

/** 멀티데이 투어: 시작일이 체크인보다 이만큼 이전이면 DB 후보에 포함 */
export const TICKET_FORM_TOUR_LOOKBACK_DAYS = 45

/** YYYY-MM-DD 기준으로 달력 일수 더하기 (DST 피하려고 정오 기준) */
function addCalendarDays(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function ymdFromDbDate(s: string | null | undefined): string {
  if (!s) return ''
  const m = String(s).trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

function localYmdFromTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/**
 * 그랜드서클 멀티나잇 등: DB `tour_end_datetime` 없이도 달력 칸 수 고정.
 * `ScheduleView` `getMultiDayTourDays` · `TicketBookingList` `ticketCalendarTourFixedSpanDays`와 동일 규칙.
 */
function ticketCalendarTourFixedSpanDays(productId: string | null | undefined): number | null {
  const pid = (productId || '').trim()
  if (!pid) return null
  if (pid.startsWith('MNGC1N') || pid.startsWith('MNM1')) return 2
  if (pid.startsWith('MNGC2N')) return 3
  if (pid.startsWith('MNGC3N')) return 4
  return null
}

function getTourCalendarEndYmd(tour: {
  tour_date: string
  tour_end_datetime?: string | null
  product_id?: string | null
}): string {
  const start = ymdFromDbDate(tour.tour_date)
  if (!start) return ''

  const fixedDays = ticketCalendarTourFixedSpanDays(tour.product_id)
  if (fixedDays !== null && fixedDays >= 1) {
    return addCalendarDays(start, fixedDays - 1)
  }

  if (tour.tour_end_datetime) {
    const end = localYmdFromTimestamp(String(tour.tour_end_datetime))
    if (!end) return start
    if (end < start) return start
    return end
  }
  return start
}

function checkInWithinTourCalendarSpan(
  checkInYmd: string,
  tour: { tour_date: string; tour_end_datetime?: string | null; product_id?: string | null }
): boolean {
  const start = ymdFromDbDate(tour.tour_date)
  const end = getTourCalendarEndYmd(tour)
  if (!checkInYmd || !start || !end) return false
  return checkInYmd >= start && checkInYmd <= end
}

function parseStaffEmails(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return []
  const parts = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(parts)]
}

async function fetchTeamDisplayMap(
  supabaseClient: { from: (t: string) => any },
  emails: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (emails.length === 0) return map
  const chunkSize = 100
  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize)
    const { data, error } = await supabaseClient
      .from('team')
      .select('email, name_ko, nick_name, name_en')
      .in('email', chunk)
    if (error) {
      console.warn('팀(가이드/어시) 이름 조회 경고:', error)
      continue
    }
    for (const row of (data || []) as Array<{
      email: string
      name_ko?: string | null
      nick_name?: string | null
      name_en?: string | null
    }>) {
      const display =
        (row.nick_name && String(row.nick_name).trim()) ||
        (row.name_ko && String(row.name_ko).trim()) ||
        (row.name_en && String(row.name_en).trim()) ||
        row.email
      map.set(row.email.toLowerCase(), display)
    }
  }
  return map
}

function staffFieldToDisplay(raw: string | null | undefined, teamMap: Map<string, string>): string {
  const emails = parseStaffEmails(raw)
  if (emails.length === 0) return ''
  return emails
    .map((e) => teamMap.get(e.toLowerCase()) || e.split('@')[0] || e)
    .filter(Boolean)
    .join(', ')
}

export type TicketTourPickerRow = {
  id: string
  tour_date: string
  tour_end_datetime?: string | null
  tour_status?: string | null
  product_id: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
  products?: { name: string }
  guide_display?: string
  assistant_display?: string
}

export async function fetchTicketToursForCheckIn(
  supabaseClient: { from: (t: string) => any },
  checkInDate: string,
  mergeTourId?: string | null
): Promise<TicketTourPickerRow[]> {
  const trimmed = String(checkInDate ?? '').trim()
  if (!trimmed) return []

  const lookbackStart = addCalendarDays(trimmed, -TICKET_FORM_TOUR_LOOKBACK_DAYS)

  const { data: rangeData, error: rangeError } = await supabaseClient
    .from('tours')
    .select('id, tour_date, tour_end_datetime, tour_status, product_id, tour_guide_id, assistant_id')
    .lte('tour_date', trimmed)
    .gte('tour_date', lookbackStart)
    .order('tour_date', { ascending: true })

  if (rangeError) {
    console.error('투어 목록 조회 오류:', rangeError)
    throw rangeError
  }

  let typedToursData = ((rangeData || []) as TicketTourPickerRow[]).filter(
    (t) =>
      !isTourCancelled(t.tour_status) && checkInWithinTourCalendarSpan(trimmed, t)
  )
  const idsInRange = new Set(typedToursData.map((x) => x.id))

  if (mergeTourId && String(mergeTourId).trim() && !idsInRange.has(String(mergeTourId).trim())) {
    const { data: extra, error: extraErr } = await supabaseClient
      .from('tours')
      .select('id, tour_date, tour_end_datetime, tour_status, product_id, tour_guide_id, assistant_id')
      .eq('id', String(mergeTourId).trim())
      .maybeSingle()
    if (!extraErr && extra) {
      typedToursData = [...typedToursData, extra as TicketTourPickerRow]
      typedToursData.sort((a, b) => String(a.tour_date).localeCompare(String(b.tour_date)))
    }
  }

  if (typedToursData.length === 0) return []

  const toursWithProductId = typedToursData.filter((tour) => tour.product_id)
  const productIds = [...new Set(toursWithProductId.map((tour) => tour.product_id).filter(Boolean))] as string[]

  const productsMap = new Map<string, { id: string; name: string }>()
  if (productIds.length > 0) {
    const { data: productsData, error: productsError } = await supabaseClient
      .from('products')
      .select('id, name')
      .in('id', productIds)

    if (productsError) {
      console.warn('상품 정보 조회 오류:', productsError)
    } else {
      ;((productsData || []) as Array<{ id: string; name: string }>).forEach((product) => {
        productsMap.set(product.id, product)
      })
    }
  }

  const emailSet = new Set<string>()
  for (const tour of typedToursData) {
    parseStaffEmails(tour.tour_guide_id).forEach((e) => emailSet.add(e))
    parseStaffEmails(tour.assistant_id).forEach((e) => emailSet.add(e))
  }
  const teamMap = await fetchTeamDisplayMap(supabaseClient, [...emailSet])

  return typedToursData.map((tour) => {
    const base: TicketTourPickerRow = { ...tour }
    if (tour.product_id && productsMap.has(tour.product_id)) {
      const product = productsMap.get(tour.product_id)!
      base.products = { name: product.name }
    }
    base.guide_display = staffFieldToDisplay(tour.tour_guide_id, teamMap)
    base.assistant_display = staffFieldToDisplay(tour.assistant_id, teamMap)
    return base
  })
}
