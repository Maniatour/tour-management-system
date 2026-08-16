import {
  addCalendarDaysYmd,
  isSeeCanyonZelleRecipient,
  normalizeTicketRnToken,
  zelleConfirmationsOverlap,
  zelleMemoRefTokens,
} from '@/lib/zellePaymentEmail'
import { isTicketBookingOffsetOrCancelRow } from '@/lib/ticketBookingSoftDelete'

export type ZelleSyncListItem = {
  id: string
  status: string
  amount: number | null
  recipient: string | null
  confirmationNumber: string | null
  paymentDateYmd: string | null
  received_at: string | null
  rnNumbers: string[]
  invoiceNumbers?: string[] | undefined
  memo?: string | null
  paidBookingIds: string[]
  unmatchedRns: string[]
  amountMismatch: boolean
  /** 같은 RN·인보이스로 묶인 분할 송금 건수 (1이면 생략) */
  splitPaymentCount?: number | undefined
  splitPaymentSum?: number | null | undefined
}

export type ZelleSyncBookingRef = {
  id: string
  company: string
  check_in_date: string
  rn_number?: string | null
  invoice_number?: string | null
  ea?: number | null
  expense?: number | null
  paid_amount?: number | null
  status?: string | null
  booking_status?: string | null
  payment_status?: string | null
  zelle_confirmation_number?: string | null
  deletion_requested_at?: string | null
}

export type ZelleDbSyncDayGroup<B extends ZelleSyncBookingRef> = {
  dateYmd: string
  zelleItems: ZelleSyncListItem[]
  linkedBookings: B[]
  unmatchedBookings: B[]
}

function isoDateOnly(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

export function zellePaymentYmd(row: ZelleSyncListItem): string | null {
  const paid = isoDateOnly(row.paymentDateYmd)
  if (paid) return paid
  const received = String(row.received_at ?? '').trim()
  if (!received) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(received)) return received
  const ms = Date.parse(received)
  if (!Number.isFinite(ms)) return isoDateOnly(received)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(ms))
}

export function isSeeCanyonTicketCompany(company: string | null | undefined): boolean {
  return isSeeCanyonZelleRecipient(company)
}

function bookingIdLinked(bookingId: string, paidIds: string[]): boolean {
  return paidIds.some(
    (id) => id === bookingId || (id.length >= 8 && (bookingId.startsWith(id) || id.startsWith(bookingId)))
  )
}

export function bookingMatchesZelleItem(booking: ZelleSyncBookingRef, item: ZelleSyncListItem): boolean {
  return zelleBookingMatchScore(booking, item) > 0
}

function bookingExpenseUsd(booking: ZelleSyncBookingRef): number {
  const n = Number(booking.expense ?? booking.paid_amount ?? 0)
  return Number.isFinite(n) ? n : 0
}

function bookingRefTokens(booking: ZelleSyncBookingRef): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of [booking.rn_number, booking.invoice_number]) {
    const token = normalizeTicketRnToken(raw)
    if (!token || seen.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out
}

function invoiceGroupExpenseUsd(booking: ZelleSyncBookingRef, all: ZelleSyncBookingRef[]): number {
  const inv = normalizeTicketRnToken(booking.invoice_number)
  if (!inv) return bookingExpenseUsd(booking)
  return all
    .filter((b) => normalizeTicketRnToken(b.invoice_number) === inv)
    .reduce((sum, b) => sum + bookingExpenseUsd(b), 0)
}

function zelleAmountMatchesBooking(
  amount: number | null,
  booking: ZelleSyncBookingRef,
  all: ZelleSyncBookingRef[]
): boolean {
  if (amount == null) return false
  const expense = bookingExpenseUsd(booking)
  const groupExpense = invoiceGroupExpenseUsd(booking, all)
  if (expense > 0 && Math.abs(amount - expense) <= 0.51) return true
  if (groupExpense > expense && Math.abs(amount - groupExpense) <= 0.51) return true
  return false
}

function bookingMemoMatchesZelle(booking: ZelleSyncBookingRef, item: ZelleSyncListItem): boolean {
  if (bookingIdLinked(booking.id, item.paidBookingIds)) return true
  const memoTokens = zelleMemoRefTokens({
    rnNumbers: item.rnNumbers,
    invoiceNumbers: item.invoiceNumbers,
  })
  const rn = normalizeTicketRnToken(booking.rn_number)
  const invoice = normalizeTicketRnToken(booking.invoice_number)
  return (
    (Boolean(rn) && memoTokens.some((n) => n === rn)) ||
    (Boolean(invoice) && memoTokens.some((n) => n === invoice))
  )
}

function zelleCoveredBookings<B extends ZelleSyncBookingRef>(
  item: ZelleSyncListItem,
  all: B[]
): B[] {
  const byPaid = all.filter((b) => bookingIdLinked(b.id, item.paidBookingIds))
  if (byPaid.length > 0) return byPaid
  return all.filter((b) => bookingMemoMatchesZelle(b, item))
}

function zelleAmountMatchesCoveredBookings<B extends ZelleSyncBookingRef>(
  item: ZelleSyncListItem,
  all: B[]
): boolean {
  if (item.amount == null) return false
  const covered = zelleCoveredBookings(item, all)
  if (covered.length === 0) return false
  const sum = covered.reduce((s, b) => s + bookingExpenseUsd(b), 0)
  return sum > 0 && Math.abs(item.amount - sum) <= 0.51
}

function zelleItemsMatchingBooking<B extends ZelleSyncBookingRef>(
  booking: B,
  items: ZelleSyncListItem[],
  siblings: B[]
): ZelleSyncListItem[] {
  return items.filter((item) => zelleBookingMatchScore(booking, item, siblings) > 0)
}

/** 1건이 금액이 맞으면 그것만, 아니면 같은 RN·인보이스 분할 송금을 모두 연결 */
function assignZelleItemsForBooking<B extends ZelleSyncBookingRef>(
  booking: B,
  items: ZelleSyncListItem[],
  siblings: B[]
): ZelleSyncListItem[] {
  const candidates = zelleItemsMatchingBooking(booking, items, siblings)
  if (candidates.length === 0) return []
  const exact = candidates.filter(
    (item) =>
      zelleAmountMatchesBooking(item.amount, booking, siblings) ||
      zelleAmountMatchesCoveredBookings(item, siblings)
  )
  if (exact.length > 0) {
    let best = exact[0]
    let bestScore = zelleBookingMatchScore(booking, best, siblings)
    for (const item of exact.slice(1)) {
      const score = zelleBookingMatchScore(booking, item, siblings)
      if (score > bestScore) {
        best = item
        bestScore = score
      }
    }
    return [best]
  }
  return candidates
}

function siblingZelleItemsFor(
  item: ZelleSyncListItem,
  assignment: Map<string, ZelleSyncListItem[]>,
  monthZelle: ZelleSyncListItem[]
): ZelleSyncListItem[] {
  const linkedBookingIds: string[] = []
  for (const [bookingId, items] of assignment) {
    if (items.some((z) => z.id === item.id)) linkedBookingIds.push(bookingId)
  }
  const ids = new Set<string>()
  for (const bookingId of linkedBookingIds) {
    for (const z of assignment.get(bookingId) ?? []) ids.add(z.id)
  }
  if (ids.size === 0) ids.add(item.id)
  return monthZelle.filter((z) => ids.has(z.id))
}

function zelleBookingMatchScore(
  booking: ZelleSyncBookingRef,
  item: ZelleSyncListItem,
  siblings: ZelleSyncBookingRef[] = []
): number {
  const idMatch = bookingIdLinked(booking.id, item.paidBookingIds)
  const memoTokens = zelleMemoRefTokens({
    rnNumbers: item.rnNumbers,
    invoiceNumbers: item.invoiceNumbers,
  })
  const rn = normalizeTicketRnToken(booking.rn_number)
  const invoice = normalizeTicketRnToken(booking.invoice_number)
  const rnMatch = Boolean(rn) && memoTokens.some((n) => n === rn)
  const invoiceMatch = Boolean(invoice) && memoTokens.some((n) => n === invoice)
  const confMatch = zelleConfirmationsOverlap(
    item.confirmationNumber,
    booking.zelle_confirmation_number
  )
  if (!idMatch && !rnMatch && !invoiceMatch && !confMatch) return 0
  let score = 0
  if (idMatch) score += 1000
  if (rnMatch) score += 100
  if (invoiceMatch) score += invoice === rn ? 0 : 100
  if (confMatch) score += 90
  if (item.status === 'paid') score += 30
  else if (item.status === 'partial') score += 20
  const expense = bookingExpenseUsd(booking)
  const groupExpense = invoiceGroupExpenseUsd(booking, siblings)
  if (item.amount != null) {
    if (expense > 0 && Math.abs(item.amount - expense) <= 0.51) score += 80
    else if (groupExpense > expense && Math.abs(item.amount - groupExpense) <= 0.51) score += 80
    else if (zelleAmountMatchesCoveredBookings(item, siblings)) score += 70
  }
  const payYmd = zellePaymentYmd(item)
  const checkIn = isoDateOnly(booking.check_in_date)
  if (payYmd && checkIn) {
    if (payYmd === checkIn) score += 12
    else {
      const pay = Date.parse(`${payYmd}T00:00:00Z`)
      const cin = Date.parse(`${checkIn}T00:00:00Z`)
      const dayDiff = Math.round((cin - pay) / 86400000)
      if (dayDiff === 1) score += 8
    }
  }
  return score
}

/** 부킹 첨부 모달: 체크인 ±N일 송금 메일만 추천 */
export function zelleItemsForBookingPicker(
  items: ZelleSyncListItem[],
  booking: ZelleSyncBookingRef,
  radiusDays = 3
): { suggested: ZelleSyncListItem[]; rest: ZelleSyncListItem[] } {
  const usable = items.filter((item) => item.status !== 'skipped')
  const checkIn = isoDateOnly(booking.check_in_date) || ''
  const nearbyIds = new Set(zelleItemsNearDate(usable, checkIn, radiusDays).map((z) => z.id))
  const suggested: ZelleSyncListItem[] = []
  const rest: ZelleSyncListItem[] = []
  for (const item of usable) {
    if (nearbyIds.has(item.id)) suggested.push(item)
    else rest.push(item)
  }
  const rank = (a: ZelleSyncListItem, b: ZelleSyncListItem) => {
    const sb = zelleBookingMatchScore(booking, b, [booking])
    const sa = zelleBookingMatchScore(booking, a, [booking])
    if (sb !== sa) return sb - sa
    return (zellePaymentYmd(b) ?? '').localeCompare(zellePaymentYmd(a) ?? '')
  }
  suggested.sort(rank)
  rest.sort(rank)
  return { suggested, rest }
}

/** 연결된 입장권의 RN·인보이스로 메모 번호를 다시 대조해 표시 상태를 맞춘다. */
export function reconcileZelleItemAgainstBookings<B extends ZelleSyncBookingRef>(
  item: ZelleSyncListItem,
  linked: B[],
  siblingItems: ZelleSyncListItem[] = [item]
): ZelleSyncListItem {
  if (item.status === 'skipped') return item

  const memoTokens = zelleMemoRefTokens({
    rnNumbers: item.rnNumbers,
    invoiceNumbers: item.invoiceNumbers,
  })
  const covered = new Set(linked.flatMap((b) => bookingRefTokens(b)))
  const unmatchedRns = memoTokens.filter((t) => !covered.has(t))
  const bookingSum = linked.reduce((s, b) => s + bookingExpenseUsd(b), 0)
  const ownMatches =
    item.amount != null && linked.length > 0 && Math.abs(item.amount - bookingSum) <= 0.51
  const siblings = ownMatches
    ? [item]
    : siblingItems.length > 0
      ? siblingItems
      : [item]
  const splitPaymentCount = siblings.length
  const splitPaymentSum = siblings.reduce((s, z) => s + (z.amount ?? 0), 0)
  const hasZelleAmount = siblings.some((z) => z.amount != null)
  const compareAmount = ownMatches ? item.amount : splitPaymentCount > 1 ? splitPaymentSum : item.amount
  const amountOk =
    compareAmount != null && linked.length > 0 && Math.abs(compareAmount - bookingSum) <= 0.51
  const amountMismatch = hasZelleAmount && linked.length > 0 && !amountOk

  let status = item.status
  if (linked.length > 0) {
    if (unmatchedRns.length === 0 && (amountOk || !hasZelleAmount)) status = 'paid'
    else if (amountMismatch) status = 'amount_mismatch'
    else status = 'partial'
  }

  return {
    ...item,
    unmatchedRns,
    amountMismatch,
    status,
    splitPaymentCount: splitPaymentCount > 1 ? splitPaymentCount : undefined,
    splitPaymentSum: splitPaymentCount > 1 ? Math.round(splitPaymentSum * 100) / 100 : undefined,
  }
}

function sortBookingsByRn<B extends ZelleSyncBookingRef>(rows: B[]): B[] {
  return [...rows].sort((a, b) => {
    const ra = normalizeTicketRnToken(a.rn_number)
    const rb = normalizeTicketRnToken(b.rn_number)
    const na = Number(ra)
    const nb = Number(rb)
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    const byRn = ra.localeCompare(rb, undefined, { numeric: true })
    if (byRn !== 0) return byRn
    return String(a.id).localeCompare(String(b.id))
  })
}

export function dayGroupNeedsZelleReview<B extends ZelleSyncBookingRef>(
  group: ZelleDbSyncDayGroup<B>
): boolean {
  if (group.unmatchedBookings.length > 0) return true
  return group.zelleItems.some(
    (item) =>
      item.status === 'unmatched' ||
      item.status === 'partial' ||
      item.status === 'amount_mismatch' ||
      item.status === 'parse_failed'
  )
}

export function lasVegasTodayYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d)
}

export function lasVegasYearMonth(d = new Date()): string {
  return lasVegasTodayYmd(d).slice(0, 7)
}

export function lasVegasYear(d = new Date()): string {
  return lasVegasTodayYmd(d).slice(0, 4)
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function shiftYear(year: string, delta: number): string {
  const y = Number(year)
  return String((Number.isFinite(y) ? y : new Date().getUTCFullYear()) + delta)
}

export function formatZelleDayHeading(ymd: string, locale: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  if (locale === 'ko') {
    return dt.toLocaleDateString('ko-KR', { timeZone: 'UTC', month: 'long', day: 'numeric' })
  }
  return dt.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
}

export function formatZelleMonthHeading(yearMonth: string, locale: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, 1, 12))
  if (locale === 'ko') {
    return dt.toLocaleDateString('ko-KR', { timeZone: 'UTC', year: 'numeric', month: 'long' })
  }
  return dt.toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long' })
}

export function formatZelleYearHeading(year: string, locale: string): string {
  return locale === 'ko' ? `${year}년` : year
}

export function formatZelleMonthChip(yearMonth: string, locale: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, 1, 12))
  if (locale === 'ko') {
    return dt.toLocaleDateString('ko-KR', { timeZone: 'UTC', month: 'long' })
  }
  return dt.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })
}

/** YYYY-MM(월별) 또는 YYYY(연간). prefix는 `2026-08-` / `2026-` */
export function buildZelleDbSyncDayGroups<B extends ZelleSyncBookingRef>(
  zelleItems: ZelleSyncListItem[],
  bookings: B[],
  periodKey: string
): ZelleDbSyncDayGroup<B>[] {
  const prefix = `${periodKey}-`
  const usableBookings = bookings.filter(
    (b) =>
      isSeeCanyonTicketCompany(b.company) &&
      !isTicketBookingOffsetOrCancelRow(b) &&
      !b.deletion_requested_at
  )

  const monthZelle = zelleItems.filter((row) => {
    const ymd = zellePaymentYmd(row)
    return Boolean(ymd && ymd.startsWith(prefix))
  })

  const assignment = new Map<string, ZelleSyncListItem[]>()
  for (const b of usableBookings) {
    const matched = assignZelleItemsForBooking(b, monthZelle, usableBookings)
    if (matched.length > 0) assignment.set(b.id, matched)
  }

  const linkedIds = new Set(assignment.keys())

  const dates = new Set<string>()
  for (const item of monthZelle) {
    const ymd = zellePaymentYmd(item)
    if (ymd) dates.add(ymd)
  }
  for (const b of usableBookings) {
    const checkIn = isoDateOnly(b.check_in_date)
    if (checkIn?.startsWith(prefix) && !linkedIds.has(b.id)) dates.add(checkIn)
  }

  return [...dates]
    .sort((a, b) => b.localeCompare(a))
    .map((dateYmd) => {
      const zelleForDay = monthZelle
        .filter((row) => zellePaymentYmd(row) === dateYmd)
        .map((item) => {
          const linkedToItem = usableBookings.filter((b) =>
            (assignment.get(b.id) ?? []).some((z) => z.id === item.id)
          )
          return reconcileZelleItemAgainstBookings(
            item,
            linkedToItem,
            siblingZelleItemsFor(item, assignment, monthZelle)
          )
        })
      const linked = sortBookingsByRn(
        usableBookings.filter((b) => {
          const items = assignment.get(b.id) ?? []
          return items.some((item) => zellePaymentYmd(item) === dateYmd)
        })
      )
      const unmatched = sortBookingsByRn(
        usableBookings.filter(
          (b) => isoDateOnly(b.check_in_date) === dateYmd && !linkedIds.has(b.id)
        )
      )
      return { dateYmd, zelleItems: zelleForDay, linkedBookings: linked, unmatchedBookings: unmatched }
    })
}

export function zelleItemsNearDate(
  items: ZelleSyncListItem[],
  centerYmd: string,
  radiusDays = 3
): ZelleSyncListItem[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(centerYmd)) return []
  const start = addCalendarDaysYmd(centerYmd, -radiusDays)
  const end = addCalendarDaysYmd(centerYmd, radiusDays)
  return items.filter((item) => {
    if (item.status === 'skipped') return false
    const ymd = zellePaymentYmd(item)
    return Boolean(ymd && ymd >= start && ymd <= end)
  })
}

function nearbyZelleRank<B extends ZelleSyncBookingRef>(
  item: ZelleSyncListItem,
  centerYmd: string,
  dayBookings: B[]
): number {
  let score = 0
  for (const b of dayBookings) {
    if (bookingMatchesZelleItem(b, item)) score += 100
  }
  const ymd = zellePaymentYmd(item)
  if (ymd === centerYmd) score += 20
  else if (ymd) {
    const a = Date.parse(`${ymd}T00:00:00Z`)
    const b = Date.parse(`${centerYmd}T00:00:00Z`)
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const diff = Math.abs(Math.round((a - b) / 86400000))
      score += Math.max(0, 12 - diff * 3)
    }
  }
  return score
}

/** 입장권 기준: Zelle 첨부가 없는 SEE CANYON 부킹 + 체크인 ±3일 Zelle 메일 */
export function buildMissingZelleAttachmentDayGroups<B extends ZelleSyncBookingRef>(
  zelleItems: ZelleSyncListItem[],
  bookings: B[],
  periodKey: string,
  hasZelleAttachment: (booking: B) => boolean
): ZelleDbSyncDayGroup<B>[] {
  const prefix = `${periodKey}-`
  const missing = bookings.filter((b) => {
    const checkIn = isoDateOnly(b.check_in_date)
    return (
      Boolean(checkIn?.startsWith(prefix)) &&
      isSeeCanyonTicketCompany(b.company) &&
      !isTicketBookingOffsetOrCancelRow(b) &&
      !b.deletion_requested_at &&
      !hasZelleAttachment(b)
    )
  })
  const dates = new Set<string>()
  for (const b of missing) {
    const checkIn = isoDateOnly(b.check_in_date)
    if (checkIn) dates.add(checkIn)
  }
  return [...dates]
    .sort((a, b) => b.localeCompare(a))
    .map((dateYmd) => {
      const dayBookings = sortBookingsByRn(
        missing.filter((b) => isoDateOnly(b.check_in_date) === dateYmd)
      )
      const nearby = zelleItemsNearDate(zelleItems, dateYmd, 3).sort((a, b) => {
        const rb = nearbyZelleRank(b, dateYmd, dayBookings)
        const ra = nearbyZelleRank(a, dateYmd, dayBookings)
        if (rb !== ra) return rb - ra
        return (zellePaymentYmd(a) ?? '').localeCompare(zellePaymentYmd(b) ?? '')
      })
      return {
        dateYmd,
        zelleItems: nearby,
        linkedBookings: [],
        unmatchedBookings: dayBookings,
      }
    })
}

export type ZelleReconKind = 'exact' | 'mismatch' | 'done'

export type ZelleReconBundle<B extends ZelleSyncBookingRef> = {
  id: string
  kind: ZelleReconKind
  dateYmd: string | null
  zelleItems: ZelleSyncListItem[]
  bookings: B[]
  zelleSum: number
  ticketSum: number
  delta: number
}

export type ZelleReconQueue<B extends ZelleSyncBookingRef> = {
  bundles: ZelleReconBundle<B>[]
  leftoverZelles: ZelleSyncListItem[]
  leftoverBookings: B[]
}

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100
}

function bookingIsPaid(booking: ZelleSyncBookingRef): boolean {
  return String(booking.payment_status ?? '').toLowerCase() === 'paid'
}

function connectedReconGroups<B extends ZelleSyncBookingRef>(
  zelles: ZelleSyncListItem[],
  bookings: B[]
): Array<{ zelleItems: ZelleSyncListItem[]; bookings: B[] }> {
  const usable = zelles.filter((item) => item.status !== 'skipped')
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const item of usable) {
    parent.set(`z:${item.id}`, `z:${item.id}`)
    for (const b of bookings) {
      parent.set(`b:${b.id}`, parent.get(`b:${b.id}`) ?? `b:${b.id}`)
      if (bookingMatchesZelleItem(b, item)) union(`z:${item.id}`, `b:${b.id}`)
    }
  }
  const buckets = new Map<string, { zelleItems: ZelleSyncListItem[]; bookings: B[] }>()
  for (const item of usable) {
    const key = `z:${item.id}`
    if (!parent.has(key)) continue
    const root = find(key)
    const bucket = buckets.get(root) ?? { zelleItems: [], bookings: [] }
    bucket.zelleItems.push(item)
    buckets.set(root, bucket)
  }
  for (const b of bookings) {
    const key = `b:${b.id}`
    if (!parent.has(key)) continue
    const root = find(key)
    const bucket = buckets.get(root)
    if (!bucket) continue
    bucket.bookings.push(b)
  }
  return [...buckets.values()]
}

function classifyReconBundle<B extends ZelleSyncBookingRef>(
  zelleItems: ZelleSyncListItem[],
  bookings: B[]
): ZelleReconBundle<B> {
  const zelleSum = roundUsd(zelleItems.reduce((s, z) => s + (z.amount ?? 0), 0))
  const ticketSum = roundUsd(bookings.reduce((s, b) => s + bookingExpenseUsd(b), 0))
  const delta = roundUsd(ticketSum - zelleSum)
  const hasAmount = zelleItems.some((z) => z.amount != null)
  const amountOk = !hasAmount || Math.abs(delta) <= 0.51
  const allPaid =
    bookings.length > 0 &&
    bookings.every(bookingIsPaid) &&
    zelleItems.every(
      (z) =>
        z.status === 'paid' ||
        bookings.every((b) => bookingIdLinked(b.id, z.paidBookingIds))
    )
  const parseFailed = zelleItems.some((z) => z.status === 'parse_failed')
  let kind: ZelleReconKind = 'mismatch'
  if (!parseFailed && amountOk && allPaid) kind = 'done'
  else if (!parseFailed && amountOk && bookings.length > 0 && zelleItems.length > 0) kind = 'exact'
  const dates = [
    ...zelleItems.map((z) => zellePaymentYmd(z)),
    ...bookings.map((b) => isoDateOnly(b.check_in_date)),
  ].filter((d): d is string => Boolean(d))
  dates.sort()
  const dateYmd = dates[dates.length - 1] ?? dates[0] ?? null
  return {
    id: `bundle:${[...zelleItems.map((z) => z.id), ...bookings.map((b) => b.id)].sort().join('+')}`,
    kind,
    dateYmd,
    zelleItems,
    bookings: sortBookingsByRn(bookings),
    zelleSum,
    ticketSum,
    delta,
  }
}

/** 기간 안 SEE CANYON 입장권·Zelle를 RN/Conf/지불ID로 묶어 정산 큐를 만든다. */
export function buildZelleReconQueue<B extends ZelleSyncBookingRef>(
  zelleItems: ZelleSyncListItem[],
  bookings: B[],
  periodKey: string
): ZelleReconQueue<B> {
  const prefix = `${periodKey}-`
  const periodZelles = zelleItems.filter((row) => {
    if (row.status === 'skipped') return false
    const ymd = zellePaymentYmd(row)
    return Boolean(ymd && ymd.startsWith(prefix))
  })
  const periodBookings = bookings.filter((b) => {
    const checkIn = isoDateOnly(b.check_in_date)
    return (
      Boolean(checkIn?.startsWith(prefix)) &&
      isSeeCanyonTicketCompany(b.company) &&
      !isTicketBookingOffsetOrCancelRow(b) &&
      !b.deletion_requested_at
    )
  })
  const usedZ = new Set<string>()
  const usedB = new Set<string>()
  const bundles: ZelleReconBundle<B>[] = []
  for (const group of connectedReconGroups(periodZelles, periodBookings)) {
    if (group.zelleItems.length === 0 || group.bookings.length === 0) continue
    for (const z of group.zelleItems) usedZ.add(z.id)
    for (const b of group.bookings) usedB.add(b.id)
    bundles.push(classifyReconBundle(group.zelleItems, group.bookings))
  }
  bundles.sort((a, b) => {
    const da = a.dateYmd ?? ''
    const db = b.dateYmd ?? ''
    if (da !== db) return db.localeCompare(da)
    return Math.abs(b.delta) - Math.abs(a.delta)
  })
  return {
    bundles,
    leftoverZelles: periodZelles.filter((z) => !usedZ.has(z.id)),
    leftoverBookings: sortBookingsByRn(periodBookings.filter((b) => !usedB.has(b.id))),
  }
}

export function leftoverNearBundle<B extends ZelleSyncBookingRef>(
  bundle: ZelleReconBundle<B>,
  leftoverZelles: ZelleSyncListItem[],
  leftoverBookings: B[],
  radiusDays = 3
): { zelles: ZelleSyncListItem[]; bookings: B[] } {
  const center = bundle.dateYmd
  if (!center) return { zelles: leftoverZelles, bookings: leftoverBookings }
  return {
    zelles: zelleItemsNearDate(leftoverZelles, center, radiusDays),
    bookings: leftoverBookings.filter((b) => {
      const checkIn = isoDateOnly(b.check_in_date)
      if (!checkIn) return false
      const start = addCalendarDaysYmd(center, -radiusDays)
      const end = addCalendarDaysYmd(center, radiusDays)
      return checkIn >= start && checkIn <= end
    }),
  }
}
