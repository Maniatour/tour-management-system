import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/database.types'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { replaceExpenseReconciliationMatch, addCalendarDaysYmd as addDaysYmd } from '@/lib/expense-reconciliation-similar-lines'
import { isTicketBookingOffsetOrCancelRow } from '@/lib/ticketBookingSoftDelete'
import { attachZelleEmailToBookings } from '@/lib/zelleEmailAttachment'
import {
  classifyCanyonVendor,
  classifyCanyonVendorFromStatementLine,
} from '@/lib/ticketBookingDateViewRecon'
import {
  fetchGmailMessageBodyDetailed,
  parseStoredGmailMessageId,
  refreshGmailAccessToken,
  zelleBodyLooksComplete,
} from '@/lib/gmailMessageBody'
import {
  isSeeCanyonZellePayment,
  isSeeCanyonZelleRecipient,
  isZellePaymentSentEmail,
  mergeZelleConfirmationNumbers,
  normalizeTicketRnToken,
  parseZellePaymentEmail,
  zelleBodyMentionsSeeCanyon,
  zelleMemoRefTokens,
  extractInvoiceNumbersFromMemo,
  zelleRecipientMatchesCompany,
  ZELLE_PAYMENT_PLATFORM_KEY,
  type ParsedZellePaymentEmail,
} from '@/lib/zellePaymentEmail'

export type ZelleMatchStatus =
  | 'skipped'
  | 'paid'
  | 'partial'
  | 'unmatched'
  | 'amount_mismatch'
  | 'parse_failed'

export type ZellePaymentProcessResult = {
  processed: boolean
  skipped: boolean
  parseOk: boolean
  status: ZelleMatchStatus
  parsed: ParsedZellePaymentEmail | null
  paidBookingIds: string[]
  unmatchedRns: string[]
  tourExpenseIds: string[]
  statementLineIds: string[]
  bookingExpenseSum: number | null
  amountMismatch: boolean
  error?: string
}

type TicketBookingMatchRow = {
  id: string
  rn_number: string | null
  invoice_number: string | null
  check_in_date: string
  company: string | null
  expense: number | null
  ea: number | null
  payment_status: string | null
  payment_method: string | null
  tour_id: string | null
  zelle_confirmation_number: string | null
  deletion_requested_at: string | null
  booking_status: string | null
  status: string | null
}

function isAlreadyProcessedExtracted(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const rec = data as Record<string, unknown>
  if (rec.zelle_processed === true) return true
  const nested = rec.zelle
  if (nested && typeof nested === 'object' && (nested as { processed?: unknown }).processed === true) {
    return true
  }
  return false
}

export type KnownZellePaymentRef = {
  importId: string
  amount: number | null
  rnNumbers: string[]
  invoiceNumbers: string[]
  paymentDateYmd: string | null
  status: string
}

function zelleDatesNearby(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true
  if (a.slice(0, 7) === b.slice(0, 7)) return true
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  if (!Number.isFinite(da) || !Number.isFinite(db)) return true
  return Math.abs(da - db) <= 14 * 86400000
}

function siblingZelleAmountSum(
  parsed: ParsedZellePaymentEmail,
  known: KnownZellePaymentRef[] | undefined,
  currentImportId: string | null | undefined
): number | null {
  const tokens = new Set(zelleMemoRefTokens(parsed))
  if (tokens.size === 0) return parsed.amount
  const amounts: number[] = []
  let currentSeen = false
  for (const row of known ?? []) {
    if (row.status === 'skipped' || row.status === 'parse_failed') continue
    const rowTokens = zelleMemoRefTokens({
      rnNumbers: row.rnNumbers,
      invoiceNumbers: row.invoiceNumbers,
    })
    if (!rowTokens.some((t) => tokens.has(t))) continue
    if (!zelleDatesNearby(parsed.paymentDateYmd, row.paymentDateYmd)) continue
    const amount = row.importId === currentImportId ? parsed.amount : row.amount
    if (amount == null) continue
    amounts.push(amount)
    if (row.importId === currentImportId) currentSeen = true
  }
  if (parsed.amount != null && !currentSeen) amounts.push(parsed.amount)
  if (amounts.length === 0) return parsed.amount
  return Math.round(amounts.reduce((s, n) => s + n, 0) * 100) / 100
}

function zelleNoteMarker(confirmation: string | null, messageId: string | null): string {
  const conf = (confirmation || '').trim()
  if (conf) return `[Zelle auto] ${conf}`
  const mid = (messageId || '').trim()
  return `[Zelle auto] ${mid || 'no-id'}`
}

async function resolveZellePaymentMethod(
  client: SupabaseClient,
  last4: string | null
): Promise<string> {
  if (!last4) return 'Zelle'
  const { data } = await client
    .from('payment_methods')
    .select('method, display_name, card_number_last4')
    .eq('status', 'active')
  const rows = (data ?? []) as Array<{
    method: string
    display_name: string | null
    card_number_last4: string | null
  }>
  const matched = rows.filter((r) => String(r.card_number_last4 ?? '').trim() === last4)
  if (matched.length === 0) return 'Zelle'
  const zellePref = matched.find((r) =>
    `${r.method} ${r.display_name ?? ''}`.toLowerCase().includes('zelle')
  )
  return (zellePref ?? matched[0])!.method
}

const TICKET_BOOKING_ZELLE_SELECT =
  'id, rn_number, invoice_number, check_in_date, company, expense, ea, payment_status, payment_method, tour_id, zelle_confirmation_number, deletion_requested_at, booking_status, status'

function bookingMemoTokens(row: TicketBookingMatchRow): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of [row.rn_number, row.invoice_number]) {
    const token = normalizeTicketRnToken(raw)
    if (!token || seen.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out
}

function pickBookingsByRn(
  rows: TicketBookingMatchRow[],
  rnSet: Set<string>,
  dateSet: Set<string>
): { inWindow: TicketBookingMatchRow[]; unmatchedRns: string[] } {
  const inWindow: TicketBookingMatchRow[] = []
  const matchedRn = new Set<string>()
  for (const row of rows) {
    const hits = bookingMemoTokens(row).filter((t) => rnSet.has(t))
    if (hits.length === 0) continue
    if (isTicketBookingOffsetOrCancelRow(row)) continue
    const ymd = String(row.check_in_date ?? '').slice(0, 10)
    if (dateSet.size > 0 && !dateSet.has(ymd)) continue
    inWindow.push(row)
    for (const hit of hits) matchedRn.add(hit)
  }
  const unmatchedRns = [...rnSet].filter((rn) => !matchedRn.has(rn))
  return { inWindow, unmatchedRns }
}

async function fetchBookingsByRnTokens(
  client: SupabaseClient,
  rns: string[]
): Promise<TicketBookingMatchRow[]> {
  if (rns.length === 0) return []
  const variants = [...new Set(rns.flatMap((rn) => [rn, `#${rn}`]))]
  const { data, error } = await client
    .from('ticket_bookings')
    .select(TICKET_BOOKING_ZELLE_SELECT)
    .in('rn_number', variants)
    .is('deletion_requested_at', null)
  if (error) {
    console.error('[zelle-payment] ticket_bookings by RN:', error.message)
    return []
  }
  return (data ?? []) as TicketBookingMatchRow[]
}

async function fetchBookingsByInvoiceTokens(
  client: SupabaseClient,
  tokens: string[]
): Promise<TicketBookingMatchRow[]> {
  if (tokens.length === 0) return []
  const variants = [...new Set(tokens.flatMap((t) => [t, `#${t}`]))]
  const { data, error } = await client
    .from('ticket_bookings')
    .select(TICKET_BOOKING_ZELLE_SELECT)
    .in('invoice_number', variants)
    .is('deletion_requested_at', null)
  if (error) {
    console.error('[zelle-payment] ticket_bookings by invoice:', error.message)
    return []
  }
  return (data ?? []) as TicketBookingMatchRow[]
}

async function fetchBookingsForRns(
  client: SupabaseClient,
  rns: string[],
  dateYmds: string[]
): Promise<TicketBookingMatchRow[]> {
  const rnSet = new Set(rns.map(normalizeTicketRnToken).filter(Boolean))
  const dateSet = new Set(dateYmds)
  const sortedDates = [...dateSet].sort()
  let windowRows: TicketBookingMatchRow[] = []
  if (sortedDates.length > 0) {
    const { data, error } = await client
      .from('ticket_bookings')
      .select(TICKET_BOOKING_ZELLE_SELECT)
      .is('deletion_requested_at', null)
      .gte('check_in_date', sortedDates[0])
      .lte('check_in_date', sortedDates[sortedDates.length - 1])
    if (error) {
      console.error('[zelle-payment] ticket_bookings date window:', error.message)
    } else {
      windowRows = (data ?? []) as TicketBookingMatchRow[]
    }
  }

  const first = pickBookingsByRn(windowRows, rnSet, dateSet)
  if (first.unmatchedRns.length === 0) return first.inWindow

  const extraRows = [
    ...(await fetchBookingsByRnTokens(client, first.unmatchedRns)),
    ...(await fetchBookingsByInvoiceTokens(client, first.unmatchedRns)),
  ]
  const seen = new Set(first.inWindow.map((r) => r.id))
  const extra = extraRows.filter((row) => {
    if (seen.has(row.id)) return false
    const hits = bookingMemoTokens(row).filter((t) => rnSet.has(t))
    if (hits.length === 0) return false
    if (isTicketBookingOffsetOrCancelRow(row)) return false
    seen.add(row.id)
    return true
  })
  return [...first.inWindow, ...extra]
}

async function markTicketBookingPaid(
  client: SupabaseClient,
  booking: TicketBookingMatchRow,
  opts: {
    confirmation: string | null
    paymentMethod: string
    actorEmail: string | null
  }
): Promise<boolean> {
  const alreadyPaid = String(booking.payment_status ?? '').toLowerCase() === 'paid'
  const existingConf = String(booking.zelle_confirmation_number ?? '').trim()

  if (!alreadyPaid) {
    const paidAmount =
      booking.expense != null && Number.isFinite(Number(booking.expense))
        ? Number(booking.expense)
        : undefined
    const payload: Record<string, unknown> = {
      payment_method: opts.paymentMethod,
    }
    if (paidAmount != null) payload.paid_amount = paidAmount
    const pendingConf = (opts.confirmation || '').trim()
    if (pendingConf) payload.zelle_confirmation_number = pendingConf
    const { error } = await client.rpc('apply_ticket_booking_action', {
      p_booking_id: booking.id,
      p_action: 'workflow_complete_payment',
      p_payload: payload as Json,
      p_actor: opts.actorEmail,
    })
    if (error) {
      console.error('[zelle-payment] workflow_complete_payment', booking.id, error.message)
      return false
    }
  }

  const confirmation = (opts.confirmation || '').trim()
  if (confirmation) {
    const merged = existingConf
      ? mergeZelleConfirmationNumbers(existingConf, confirmation)
      : confirmation
    if (merged !== existingConf) {
      const { error } = await client
        .from('ticket_bookings')
        .update({ zelle_confirmation_number: merged })
        .eq('id', booking.id)
      if (error) {
        console.error('[zelle-payment] zelle_confirmation_number', booking.id, error.message)
      } else {
        booking.zelle_confirmation_number = merged
      }
    }
  }
  return true
}

async function appendZelleEvidenceNote(
  client: SupabaseClient,
  booking: TicketBookingMatchRow,
  parsed: ParsedZellePaymentEmail
): Promise<void> {
  const marker = zelleNoteMarker(parsed.confirmationNumber, null)
  const { data: row } = await client
    .from('ticket_bookings')
    .select('note')
    .eq('id', booking.id)
    .maybeSingle()
  const current = String((row as { note?: string | null } | null)?.note ?? '')
  if (current.includes(marker)) return
  const rns = parsed.rnNumbers.map((n) => `#${n}`).join(' ')
  const line = `${marker} $${parsed.amount ?? '—'} ${parsed.paymentDateYmd ?? ''} ${rns}`.trim()
  const next = current.trim() ? `${current.trim()}\n${line}` : line
  await client.from('ticket_bookings').update({ note: next }).eq('id', booking.id)
}

async function linkStatementLinesForZelle(
  client: SupabaseClient,
  parsed: ParsedZellePaymentEmail,
  bookings: TicketBookingMatchRow[],
  actorEmail: string
): Promise<string[]> {
  if (bookings.length === 0 || parsed.amount == null || !parsed.paymentDateYmd) return []
  const start = addDaysYmd(parsed.paymentDateYmd, -3)
  const end = addDaysYmd(parsed.paymentDateYmd, 3)
  const operatorId = resolveOperatorId(null)
  const { data, error } = await client
    .from('statement_lines')
    .select('id, posted_date, amount, direction, description, merchant, matched_status')
    .eq('operator_id', operatorId)
    .eq('direction', 'outflow')
    .gte('posted_date', start)
    .lte('posted_date', end)
    .in('matched_status', ['unmatched', 'partial'])
    .limit(80)
  if (error) {
    console.error('[zelle-payment] statement_lines:', error.message)
    return []
  }
  const target = parsed.amount
  const recKey = classifyCanyonVendor(parsed.recipient)
  const scored = (data ?? [])
    .map((line) => {
      const amt = Math.abs(Number(line.amount ?? 0))
      const amountDiff = Math.abs(amt - target)
      if (amountDiff > 0.51) return null
      const hay = `${line.merchant ?? ''} ${line.description ?? ''}`.toLowerCase()
      let score = amountDiff < 0.02 ? 40 : 20
      if (/\bzelle\b/.test(hay)) score += 30
      const lineKey = classifyCanyonVendorFromStatementLine(line)
      if (recKey && lineKey && recKey === lineKey) score += 25
      else if (lineKey) score += 8
      return { id: String(line.id), amount: amt, score }
    })
    .filter((x): x is { id: string; amount: number; score: number } => x != null)
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score < 40) return []

  const linked: string[] = []
  for (const booking of bookings) {
    const share =
      booking.expense != null && Number.isFinite(Number(booking.expense))
        ? Math.abs(Number(booking.expense))
        : target / bookings.length
    try {
      await replaceExpenseReconciliationMatch(client, {
        actorEmail,
        sourceTable: 'ticket_bookings',
        sourceId: booking.id,
        statementLineId: best.id,
        statementLineAmount: best.amount,
        matchedAmount: share,
        linkMode: 'replace',
        matchKind: 'auto',
        operatorId,
      })
      linked.push(best.id)
    } catch (e) {
      console.error('[zelle-payment] statement link', booking.id, e)
    }
  }
  return [...new Set(linked)]
}

async function insertTourExpenseIfUnmatched(
  client: SupabaseClient,
  parsed: ParsedZellePaymentEmail,
  bookings: TicketBookingMatchRow[],
  opts: {
    paymentMethod: string
    actorEmail: string
    messageId: string | null
  }
): Promise<string[]> {
  if (bookings.length > 0) return []
  if (parsed.amount == null || !parsed.paymentDateYmd) return []
  const marker = zelleNoteMarker(parsed.confirmationNumber, opts.messageId)
  const { data: existing } = await client
    .from('tour_expenses')
    .select('id')
    .ilike('note', `%${marker}%`)
    .limit(5)
  if ((existing ?? []).length > 0) {
    return (existing ?? []).map((r) => String((r as { id: string }).id)).filter(Boolean)
  }

  const paidTo = (parsed.recipient || 'SEE CANYON').replace(/\s+/g, ' ').trim()
  const rnLabel = parsed.rnNumbers.map((n) => `#${n}`).join(', ')
  const operatorId = resolveOperatorId(null)
  const note = `${marker} RN ${rnLabel || '—'} · sent $${parsed.amount} (입장권 미매칭)`.trim()
  const { data: ins, error } = await client
    .from('tour_expenses')
    .insert({
      tour_id: null,
      tour_date: parsed.paymentDateYmd,
      paid_to: paidTo,
      paid_for: '입장권',
      amount: parsed.amount,
      payment_method: opts.paymentMethod,
      note,
      submitted_by: opts.actorEmail,
      status: 'approved',
      operator_id: operatorId,
    })
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[zelle-payment] tour_expenses insert:', error.message)
    return []
  }
  return ins?.id ? [ins.id] : []
}

async function upsertZelleImportRow(
  client: SupabaseClient,
  args: {
    messageId: string | null
    sourceEmail: string | null
    subject: string
    receivedAt: string
    bodyText: string
    parsed: ParsedZellePaymentEmail
    result: Omit<ZellePaymentProcessResult, 'parsed'>
    reparseToken?: string | null | undefined
    gmailBodyFetchDone?: boolean | undefined
  }
): Promise<void> {
  const extracted: Json = {
    zelle_processed: true,
    is_booking_confirmed: false,
    zelle: {
      processed: true,
      status: args.result.status,
      amount: args.parsed.amount,
      recipient: args.parsed.recipient,
      paymentDateYmd: args.parsed.paymentDateYmd,
      confirmationNumber: args.parsed.confirmationNumber,
      memo: args.parsed.memo,
      rnNumbers: args.parsed.rnNumbers,
      invoiceNumbers: args.parsed.invoiceNumbers,
      paidBookingIds: args.result.paidBookingIds,
      unmatchedRns: args.result.unmatchedRns,
      tourExpenseIds: args.result.tourExpenseIds,
      statementLineIds: args.result.statementLineIds,
      bookingExpenseSum: args.result.bookingExpenseSum,
      amountMismatch: args.result.amountMismatch,
      error: args.result.error ?? null,
      reparseToken: args.reparseToken ?? null,
      gmailBodyFetchDone: args.gmailBodyFetchDone === true,
    },
  }

  if (args.messageId) {
    const { data: existing } = await client
      .from('reservation_imports')
      .select('id')
      .eq('message_id', args.messageId)
      .maybeSingle()
    if (existing?.id) {
      const patch: Record<string, unknown> = {
        platform_key: ZELLE_PAYMENT_PLATFORM_KEY,
        status: 'confirmed',
        extracted_data: extracted,
      }
      if (args.bodyText.trim()) {
        patch.raw_body_text = args.bodyText.slice(0, 50000)
      }
      await client.from('reservation_imports').update(patch).eq('id', existing.id)
      return
    }
  }

  await client.from('reservation_imports').insert({
    message_id: args.messageId,
    source_email: args.sourceEmail,
    platform_key: ZELLE_PAYMENT_PLATFORM_KEY,
    subject: args.subject,
    received_at: args.receivedAt,
    raw_body_text: args.bodyText.slice(0, 50000),
    raw_body_html: null,
    extracted_data: extracted,
    status: 'confirmed',
  })
}

export async function processZellePaymentEmail(
  client: SupabaseClient,
  input: {
    subject: string
    text: string | null
    html?: string | null
    messageId: string | null
    sourceEmail: string | null
    receivedAt: string
    actorEmail?: string | null | undefined
    force?: boolean
    currentImportId?: string | null
    knownZellePayments?: KnownZellePaymentRef[]
    reparseToken?: string | null | undefined
    gmailBodyFetchDone?: boolean | undefined
  }
): Promise<ZellePaymentProcessResult> {
  const empty: ZellePaymentProcessResult = {
    processed: false,
    skipped: true,
    parseOk: false,
    status: 'skipped',
    parsed: null,
    paidBookingIds: [],
    unmatchedRns: [],
    tourExpenseIds: [],
    statementLineIds: [],
    bookingExpenseSum: null,
    amountMismatch: false,
  }
  if (!isZellePaymentSentEmail(input.subject)) return empty

  if (!input.force && input.messageId) {
    const { data: existing } = await client
      .from('reservation_imports')
      .select('id, extracted_data, platform_key')
      .eq('message_id', input.messageId)
      .maybeSingle()
    if (existing && isAlreadyProcessedExtracted(existing.extracted_data)) {
      return { ...empty, skipped: true, parseOk: true }
    }
  }

  const parsed = parseZellePaymentEmail(input.text, input.html ?? null)
  const parseOk = parsed.amount != null
  const bodyBlob = [input.text ?? '', input.html ?? ''].join('\n')
  const classified = Boolean(parsed.recipient?.trim()) || Boolean(bodyBlob.trim())
  const seeCanyon = isSeeCanyonZellePayment(parsed.recipient, bodyBlob)
  const rawActor = (input.actorEmail || '').trim()
  const actorEmail =
    !rawActor || /wellsfargo|zelle|alerts@|noreply@/i.test(rawActor)
      ? 'zelle-email-import'
      : rawActor

  if (classified && !seeCanyon) {
    const skipped: ZellePaymentProcessResult = {
      processed: true,
      skipped: true,
      parseOk,
      status: 'skipped',
      parsed,
      paidBookingIds: [],
      unmatchedRns: [],
      tourExpenseIds: [],
      statementLineIds: [],
      bookingExpenseSum: null,
      amountMismatch: false,
    }
    try {
      await upsertZelleImportRow(client, {
        messageId: input.messageId,
        sourceEmail: input.sourceEmail,
        subject: input.subject,
        receivedAt: input.receivedAt,
        bodyText: input.text || '',
        parsed,
        result: skipped,
        reparseToken: input.reparseToken,
        gmailBodyFetchDone: input.gmailBodyFetchDone,
      })
    } catch (e) {
      console.error('[zelle-payment] skip upsert:', e)
    }
    return skipped
  }

  const result: ZellePaymentProcessResult = {
    processed: false,
    skipped: false,
    parseOk,
    status: parseOk ? 'unmatched' : 'parse_failed',
    parsed,
    paidBookingIds: [],
    unmatchedRns: zelleMemoRefTokens(parsed),
    tourExpenseIds: [],
    statementLineIds: [],
    bookingExpenseSum: null,
    amountMismatch: false,
  }

  try {
    const dateYmds = [parsed.paymentDateYmd, parsed.nextDateYmd].filter(
      (d): d is string => Boolean(d)
    )

    let bookings: TicketBookingMatchRow[] = []
    const memoTokens = zelleMemoRefTokens(parsed)
    if (memoTokens.length > 0) {
      bookings = await fetchBookingsForRns(client, memoTokens, dateYmds)
      bookings = bookings.filter((b) =>
        zelleRecipientMatchesCompany(parsed.recipient, b.company)
      )
    }

    const paymentMethod = await resolveZellePaymentMethod(client, parsed.fromAccountLast4)
    const paidIds: string[] = []
    for (const booking of bookings) {
      const ok = await markTicketBookingPaid(client, booking, {
        confirmation: parsed.confirmationNumber,
        paymentMethod,
        actorEmail,
      })
      if (ok) {
        paidIds.push(booking.id)
        await appendZelleEvidenceNote(client, booking, parsed)
      }
    }

    if (paidIds.length > 0 && input.currentImportId) {
      await attachZelleEmailToBookings(
        client,
        input.currentImportId,
        bookings.filter((b) => paidIds.includes(b.id))
      )
    }

    const matchedRn = new Set(bookings.flatMap((b) => bookingMemoTokens(b)))
    const unmatchedRns = memoTokens.filter((rn) => !matchedRn.has(rn))
    const bookingExpenseSum = bookings.reduce((sum, b) => {
      const n = Number(b.expense ?? 0)
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
    const zelleCompareAmount = siblingZelleAmountSum(
      parsed,
      input.knownZellePayments,
      input.currentImportId
    )
    const amountMismatch =
      zelleCompareAmount != null &&
      bookings.length > 0 &&
      Math.abs(zelleCompareAmount - bookingExpenseSum) > 0.51

    const tourExpenseIds = await insertTourExpenseIfUnmatched(client, parsed, bookings, {
      paymentMethod,
      actorEmail,
      messageId: input.messageId,
    })

    const statementLineIds = await linkStatementLinesForZelle(
      client,
      parsed,
      bookings.filter((b) => paidIds.includes(b.id)),
      actorEmail
    )

    let status: ZelleMatchStatus = 'unmatched'
    if (!parseOk) status = 'parse_failed'
    else if (bookings.length === 0) status = 'unmatched'
    else if (unmatchedRns.length > 0) status = 'partial'
    else if (amountMismatch) status = 'amount_mismatch'
    else status = 'paid'

    result.processed = paidIds.length > 0 || tourExpenseIds.length > 0 || parseOk
    result.status = status
    result.paidBookingIds = paidIds
    result.unmatchedRns = unmatchedRns
    result.tourExpenseIds = tourExpenseIds
    result.statementLineIds = statementLineIds
    result.bookingExpenseSum = bookings.length > 0 ? Math.round(bookingExpenseSum * 100) / 100 : null
    result.amountMismatch = amountMismatch
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
    console.error('[zelle-payment] process failed:', result.error)
  }

  try {
    await upsertZelleImportRow(client, {
      messageId: input.messageId,
      sourceEmail: input.sourceEmail,
      subject: input.subject,
      receivedAt: input.receivedAt,
      bodyText: input.text || '',
      parsed,
      result,
      reparseToken: input.reparseToken,
      gmailBodyFetchDone: input.gmailBodyFetchDone,
    })
  } catch (e) {
    console.error('[zelle-payment] import row upsert:', e)
  }

  return result
}

export type ZelleImportListRow = {
  id: string
  subject: string | null
  received_at: string | null
  processed: boolean
  status: ZelleMatchStatus | 'pending'
  amount: number | null
  recipient: string | null
  confirmationNumber: string | null
  paymentDateYmd: string | null
  rnNumbers: string[]
  invoiceNumbers: string[]
  memo: string | null
  unmatchedRns: string[]
  paidBookingIds: string[]
  amountMismatch: boolean
}

function zelleStatusFromExtracted(data: unknown): {
  processed: boolean
  status: ZelleMatchStatus | 'pending'
  amount: number | null
  recipient: string | null
  confirmationNumber: string | null
  paymentDateYmd: string | null
  rnNumbers: string[]
  invoiceNumbers: string[]
  memo: string | null
  unmatchedRns: string[]
  paidBookingIds: string[]
  amountMismatch: boolean
  reparseToken: string | null
  gmailBodyFetchDone: boolean
} {
  const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const zelle = rec.zelle && typeof rec.zelle === 'object' ? (rec.zelle as Record<string, unknown>) : {}
  const processed = rec.zelle_processed === true || zelle.processed === true
  const amount = typeof zelle.amount === 'number' ? zelle.amount : null
  const recipient =
    typeof zelle.recipient === 'string'
      ? zelle.recipient.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : null
  const statusRaw = String(zelle.status ?? (processed ? 'paid' : 'pending'))
  let status = (
    [
      'skipped',
      'paid',
      'partial',
      'unmatched',
      'amount_mismatch',
      'parse_failed',
      'pending',
    ] as const
  ).includes(statusRaw as ZelleMatchStatus | 'pending')
    ? (statusRaw as ZelleMatchStatus | 'pending')
    : processed
      ? 'paid'
      : 'pending'
  // 본문 없이 processed만 찍힌 건은 지불 완료가 아니라 파싱 실패다.
  if (status !== 'skipped' && amount == null && !recipient) {
    status = 'parse_failed'
  }
  return {
    processed,
    status,
    amount,
    recipient,
    confirmationNumber: typeof zelle.confirmationNumber === 'string' ? zelle.confirmationNumber : null,
    paymentDateYmd: typeof zelle.paymentDateYmd === 'string' ? zelle.paymentDateYmd : null,
    rnNumbers: Array.isArray(zelle.rnNumbers) ? zelle.rnNumbers.map(String) : [],
    invoiceNumbers: Array.isArray(zelle.invoiceNumbers)
      ? zelle.invoiceNumbers.map(String)
      : extractInvoiceNumbersFromMemo(typeof zelle.memo === 'string' ? zelle.memo : ''),
    memo: typeof zelle.memo === 'string' && zelle.memo.trim() ? zelle.memo.trim() : null,
    unmatchedRns: Array.isArray(zelle.unmatchedRns) ? zelle.unmatchedRns.map(String) : [],
    paidBookingIds: Array.isArray(zelle.paidBookingIds) ? zelle.paidBookingIds.map(String) : [],
    amountMismatch: zelle.amountMismatch === true,
    reparseToken: typeof zelle.reparseToken === 'string' && zelle.reparseToken ? zelle.reparseToken : null,
    gmailBodyFetchDone: zelle.gmailBodyFetchDone === true,
  }
}

function hasStoredZelleBody(text: string | null | undefined, html: string | null | undefined): boolean {
  return Boolean((text ?? '').trim() || (html ?? '').trim())
}

function hasUsableZelleBody(text: string | null | undefined, html: string | null | undefined): boolean {
  const blob = [text ?? '', html ?? ''].join('\n').trim()
  return blob.length > 0 && zelleBodyLooksComplete(blob)
}

function rowNeedsZelleProcess(
  extra: ReturnType<typeof zelleStatusFromExtracted>,
  opts: { reprocessUnmatched: boolean; reparseFailed: boolean; reparseToken: string | null; hasUsableBody: boolean }
): boolean {
  if (extra.status === 'skipped') return false
  if (extra.recipient && !isSeeCanyonZelleRecipient(extra.recipient)) return false
  if (extra.status === 'parse_failed') {
    if (opts.reparseFailed) return extra.reparseToken !== opts.reparseToken
    if (!opts.hasUsableBody && !extra.gmailBodyFetchDone) return true
    return false
  }
  if (!extra.processed) return true
  return (
    opts.reprocessUnmatched &&
    (extra.status === 'unmatched' || extra.status === 'partial' || extra.status === 'amount_mismatch')
  )
}

const ZELLE_IMPORT_PAGE = 1000

async function fetchAllZelleReservationImportRows<Row extends Record<string, unknown>>(
  client: SupabaseClient,
  select: string
): Promise<Row[]> {
  const out: Row[] = []
  let from = 0
  while (true) {
    const to = from + ZELLE_IMPORT_PAGE - 1
    const { data, error } = await client
      .from('reservation_imports')
      .select(select)
      .or(`platform_key.eq.${ZELLE_PAYMENT_PLATFORM_KEY},subject.ilike.%You sent money with Zelle%`)
      .order('received_at', { ascending: false })
      .range(from, to)
    if (error) {
      console.error('[zelle-payment] page:', error.message)
      break
    }
    const rows = (data ?? []) as unknown as Row[]
    out.push(...rows)
    if (rows.length < ZELLE_IMPORT_PAGE) break
    from += ZELLE_IMPORT_PAGE
  }
  return out
}

export async function listZelleReservationImports(
  client: SupabaseClient,
  _opts?: { limit?: number }
): Promise<ZelleImportListRow[]> {
  const data = await fetchAllZelleReservationImportRows<{
    id: string
    subject: string | null
    received_at: string | null
    extracted_data: unknown
    platform_key: string | null
    raw_body_text: string | null
    raw_body_html: string | null
  }>(client, 'id, subject, received_at, extracted_data, platform_key, raw_body_text, raw_body_html')
  const mapped = data
    .filter((row) => isZellePaymentSentEmail(row.subject) || row.platform_key === ZELLE_PAYMENT_PLATFORM_KEY)
    .map((row) => {
      let extra = zelleStatusFromExtracted(row.extracted_data)
      if (
        (!extra.recipient || extra.amount == null || !extra.paymentDateYmd || !extra.memo) &&
        hasStoredZelleBody(row.raw_body_text, row.raw_body_html)
      ) {
        const parsed = parseZellePaymentEmail(row.raw_body_text, row.raw_body_html)
        extra = {
          ...extra,
          amount: extra.amount ?? parsed.amount,
          recipient: extra.recipient ?? parsed.recipient,
          confirmationNumber: extra.confirmationNumber ?? parsed.confirmationNumber,
          paymentDateYmd: extra.paymentDateYmd ?? parsed.paymentDateYmd,
          rnNumbers: extra.rnNumbers.length > 0 ? extra.rnNumbers : parsed.rnNumbers,
          invoiceNumbers:
            extra.invoiceNumbers.length > 0 ? extra.invoiceNumbers : parsed.invoiceNumbers,
          memo: extra.memo ?? parsed.memo,
        }
      }
      return {
        id: row.id,
        subject: row.subject,
        received_at: row.received_at,
        ...extra,
        seeCanyonInBody: zelleBodyMentionsSeeCanyon(row.raw_body_text, row.raw_body_html),
      }
    })
    .filter((row) => {
      if (isSeeCanyonZelleRecipient(row.recipient)) return true
      if (row.status !== 'parse_failed') return false
      return row.seeCanyonInBody
    })
    .map(({ seeCanyonInBody: _seeCanyonInBody, ...row }) => row)

  const seenConf = new Set<string>()
  const seenFailedAt = new Set<string>()
  const out: ZelleImportListRow[] = []
  for (const row of mapped) {
    const conf = (row.confirmationNumber || '').trim().toUpperCase()
    if (conf) {
      if (seenConf.has(conf)) continue
      seenConf.add(conf)
    } else if (row.status === 'parse_failed' && row.received_at) {
      if (seenFailedAt.has(row.received_at)) continue
      seenFailedAt.add(row.received_at)
    }
    out.push(row)
  }
  return out
}

export async function processZellePaymentsFromReservationImports(
  client: SupabaseClient,
  opts?: {
    actorEmail?: string | null
    reprocessUnmatched?: boolean
    reparseFailed?: boolean
    reparseToken?: string | null
    importIds?: string[] | undefined
    batchSize?: number
  }
): Promise<{
  processed: number
  remaining: number
  fetchedBodies: number
  skippedVendors: number
  gmailError: string | null
  items: Array<ZellePaymentProcessResult & { importId: string; receivedAt: string | null }>
}> {
  const empty = {
    processed: 0,
    remaining: 0,
    fetchedBodies: 0,
    skippedVendors: 0,
    gmailError: null as string | null,
    items: [] as Array<ZellePaymentProcessResult & { importId: string; receivedAt: string | null }>,
  }
  const fullRows = await fetchAllZelleReservationImportRows<{
    id: string
    message_id: string | null
    source_email: string | null
    subject: string | null
    received_at: string | null
    raw_body_text: string | null
    raw_body_html: string | null
    extracted_data: unknown
    platform_key: string | null
  }>(
    client,
    'id, message_id, source_email, subject, received_at, raw_body_text, raw_body_html, extracted_data, platform_key'
  )
  if (fullRows.length === 0) return empty

  const candidates = (fullRows ?? []).filter(
    (row) => isZellePaymentSentEmail(row.subject) || row.platform_key === ZELLE_PAYMENT_PLATFORM_KEY
  )
  const reprocessUnmatched = opts?.reprocessUnmatched === true
  const reparseFailed = opts?.reparseFailed === true
  const reparseToken =
    typeof opts?.reparseToken === 'string' && opts.reparseToken.trim()
      ? opts.reparseToken.trim()
      : reparseFailed
        ? `auto-${Date.now()}`
        : null
  const importIdFilter = new Set((opts?.importIds ?? []).filter(Boolean))
  const needing = candidates.filter((row) => {
    if (importIdFilter.size > 0 && !importIdFilter.has(row.id)) return false
    return rowNeedsZelleProcess(zelleStatusFromExtracted(row.extracted_data), {
      reprocessUnmatched,
      reparseFailed,
      reparseToken,
      hasUsableBody: hasUsableZelleBody(row.raw_body_text, row.raw_body_html),
    })
  })
  const batchSize = Math.min(Math.max(opts?.batchSize ?? 20, 1), 40)
  const batch = needing.slice(0, batchSize)
  const remaining = Math.max(0, needing.length - batch.length)
  if (batch.length === 0) return empty

  let accessToken: string | null = null
  let gmailError: string | null = null
  const needsGmail = batch.some((row) => {
    const extra = zelleStatusFromExtracted(row.extracted_data)
    return (
      !hasUsableZelleBody(row.raw_body_text, row.raw_body_html) ||
      (reparseFailed && extra.status === 'parse_failed')
    )
  })
  if (needsGmail) {
    const token = await refreshGmailAccessToken(client)
    if ('error' in token) gmailError = token.error
    else accessToken = token.accessToken
  }

  const knownZellePayments: KnownZellePaymentRef[] = candidates.map((c) => {
    const info = zelleStatusFromExtracted(c.extracted_data)
    return {
      importId: c.id,
      amount: info.amount,
      rnNumbers: info.rnNumbers,
      invoiceNumbers: info.invoiceNumbers,
      paymentDateYmd: info.paymentDateYmd,
      status: info.status,
    }
  })

  let fetchedBodies = 0
  let skippedVendors = 0
  const items: Array<ZellePaymentProcessResult & { importId: string; receivedAt: string | null }> = []
  let processed = 0
  for (const row of batch) {
    const extra = zelleStatusFromExtracted(row.extracted_data)
    let text = row.raw_body_text ?? ''
    let html = row.raw_body_html ?? null
    const shouldFetchGmail =
      Boolean(accessToken) &&
      (!hasUsableZelleBody(text, html) || (reparseFailed && extra.status === 'parse_failed'))
    let gmailBodyFetchDone = extra.gmailBodyFetchDone
    if (shouldFetchGmail) {
      const gmailId = parseStoredGmailMessageId(row.message_id)
      if (gmailId) {
        const fetched = await fetchGmailMessageBodyDetailed(accessToken as string, gmailId)
        const retryable = fetched.httpStatus === 429 || fetched.httpStatus >= 500
        if (retryable) {
          gmailError = gmailError || `Gmail 본문 조회 실패 (${fetched.httpStatus})`
        } else {
          gmailBodyFetchDone = true
        }
        if (fetched.text.trim()) {
          const clipped = fetched.text.slice(0, 50000)
          if (/<\/?[a-z][\s\S]{0,80}>/i.test(clipped)) {
            html = clipped
            text = clipped
          } else {
            text = clipped
            html = null
          }
          fetchedBodies += 1
          await client
            .from('reservation_imports')
            .update({
              raw_body_text: text.slice(0, 50000),
              raw_body_html: html ? html.slice(0, 50000) : null,
            })
            .eq('id', row.id)
        }
      } else {
        gmailBodyFetchDone = true
      }
    }
    const r = await processZellePaymentEmail(client, {
      subject: row.subject ?? '',
      text,
      html,
      messageId: row.message_id,
      sourceEmail: row.source_email,
      receivedAt: row.received_at ?? new Date().toISOString(),
      actorEmail: opts?.actorEmail,
      force: extra.processed,
      currentImportId: row.id,
      knownZellePayments,
      reparseToken: reparseFailed ? reparseToken : extra.reparseToken,
      gmailBodyFetchDone,
    })
    if (!hasStoredZelleBody(text, html) && r.status === 'parse_failed') {
      r.error = gmailError || 'DB에 메일 본문이 없어 Gmail에서 가져오지 못했습니다.'
    }
    if (r.status === 'skipped') {
      skippedVendors += 1
    } else if (
      isSeeCanyonZellePayment(r.parsed?.recipient, [text, html ?? ''].join('\n')) ||
      r.status === 'parse_failed'
    ) {
      items.push({ ...r, importId: row.id, receivedAt: row.received_at ?? null })
    }
    if (r.processed) processed += 1
  }
  return { processed, remaining, fetchedBodies, skippedVendors, gmailError, items }
}

export async function applyZelleGroupLinkToBookings(
  client: SupabaseClient,
  opts: {
    importIds: string[]
    bookingIds: string[]
    actorEmail: string
  }
): Promise<{ paidBookingIds: string[]; attached: number; error?: string }> {
  const importIds = [...new Set(opts.importIds.filter(Boolean))]
  const bookingIds = [...new Set(opts.bookingIds.filter(Boolean))]
  if (importIds.length === 0) return { paidBookingIds: [], attached: 0, error: 'Zelle 송금이 없습니다.' }
  if (bookingIds.length === 0) return { paidBookingIds: [], attached: 0, error: '부킹이 없습니다.' }

  const { data: bookingRows, error: bookingErr } = await client
    .from('ticket_bookings')
    .select(TICKET_BOOKING_ZELLE_SELECT)
    .in('id', bookingIds)
  if (bookingErr) return { paidBookingIds: [], attached: 0, error: bookingErr.message }

  const bookings = ((bookingRows ?? []) as TicketBookingMatchRow[]).filter(
    (b) => !isTicketBookingOffsetOrCancelRow(b) && !b.deletion_requested_at
  )
  if (bookings.length === 0) return { paidBookingIds: [], attached: 0, error: '연결할 입장권이 없습니다.' }

  type LoadedImport = {
    id: string
    parsed: ParsedZellePaymentEmail
    text: string
  }
  const loaded: LoadedImport[] = []
  for (const importId of importIds) {
    const { data: importRow, error: importErr } = await client
      .from('reservation_imports')
      .select('id, message_id, raw_body_text, raw_body_html, extracted_data')
      .eq('id', importId)
      .maybeSingle()
    if (importErr) return { paidBookingIds: [], attached: 0, error: importErr.message }
    if (!importRow) return { paidBookingIds: [], attached: 0, error: 'Zelle 메일을 찾을 수 없습니다.' }

    let text = String(importRow.raw_body_text ?? '')
    let html = importRow.raw_body_html ?? null
    if (!hasStoredZelleBody(text, html)) {
      const token = await refreshGmailAccessToken(client)
      if (!('error' in token)) {
        const gmailId = parseStoredGmailMessageId(importRow.message_id)
        if (gmailId) {
          const fetched = await fetchGmailMessageBodyDetailed(token.accessToken, gmailId)
          if (fetched.text.trim()) {
            text = fetched.text.slice(0, 50000)
            html = null
            await client.from('reservation_imports').update({ raw_body_text: text }).eq('id', importId)
          }
        }
      }
    }
    const parsed = parseZellePaymentEmail(text || null, html)
    const extractedConf = zelleStatusFromExtracted(importRow.extracted_data).confirmationNumber
    loaded.push({
      id: importId,
      parsed: {
        ...parsed,
        confirmationNumber: parsed.confirmationNumber || extractedConf,
      },
      text,
    })
  }

  const zelleSum = loaded.reduce((s, row) => s + (row.parsed.amount ?? 0), 0)
  const bookingExpenseSum = bookings.reduce((sum, b) => {
    const n = Number(b.expense ?? 0)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  const hasZelleAmount = loaded.some((row) => row.parsed.amount != null)
  const amountOk = !hasZelleAmount || Math.abs(zelleSum - bookingExpenseSum) <= 0.51
  const paidIds = bookings.map((b) => b.id)

  for (const row of loaded) {
    const paymentMethod = await resolveZellePaymentMethod(client, row.parsed.fromAccountLast4)
    for (const booking of bookings) {
      const ok = await markTicketBookingPaid(client, booking, {
        confirmation: row.parsed.confirmationNumber,
        paymentMethod,
        actorEmail: opts.actorEmail,
      })
      if (ok) await appendZelleEvidenceNote(client, booking, row.parsed)
    }
    await attachZelleEmailToBookings(client, row.id, bookings)

    const status: ZelleMatchStatus = amountOk ? 'paid' : 'amount_mismatch'
    const extracted: Json = {
      zelle_processed: true,
      is_booking_confirmed: false,
      zelle: {
        processed: true,
        status,
        amount: row.parsed.amount,
        recipient: row.parsed.recipient,
        paymentDateYmd: row.parsed.paymentDateYmd,
        confirmationNumber: row.parsed.confirmationNumber,
        memo: row.parsed.memo,
        rnNumbers: row.parsed.rnNumbers,
        invoiceNumbers: row.parsed.invoiceNumbers,
        paidBookingIds: paidIds,
        unmatchedRns: [],
        tourExpenseIds: [],
        statementLineIds: [],
        bookingExpenseSum: Math.round(bookingExpenseSum * 100) / 100,
        amountMismatch: hasZelleAmount && !amountOk,
        splitPaymentCount: loaded.length > 1 ? loaded.length : undefined,
        splitPaymentSum: loaded.length > 1 ? Math.round(zelleSum * 100) / 100 : undefined,
        error: null,
      },
    }
    await client
      .from('reservation_imports')
      .update({
        platform_key: ZELLE_PAYMENT_PLATFORM_KEY,
        status: 'confirmed',
        extracted_data: extracted,
        raw_body_text: row.text.slice(0, 50000),
      })
      .eq('id', row.id)
  }

  return { paidBookingIds: paidIds, attached: loaded.length * bookings.length }
}

export async function applyZelleImportLinkToBookings(
  client: SupabaseClient,
  opts: {
    importId: string
    bookingIds: string[]
    actorEmail: string
  }
): Promise<{ paidBookingIds: string[]; attached: number; error?: string }> {
  return applyZelleGroupLinkToBookings(client, {
    importIds: [opts.importId],
    bookingIds: opts.bookingIds,
    actorEmail: opts.actorEmail,
  })
}
