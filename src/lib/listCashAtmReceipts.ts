import type { SupabaseClient } from '@supabase/supabase-js'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  addCalendarDaysYmd,
  ATM_RECEIPT_DAY_WINDOW,
  isWellsFargoAtmReceiptEmail,
  parseWellsFargoAtmReceipt,
  type ParsedWellsFargoAtmReceipt,
} from '@/lib/wellsFargoAtmReceipt'

export type AtmReceiptListItem = {
  id: string
  subject: string | null
  from: string | null
  receivedAt: string | null
  parsed: ParsedWellsFargoAtmReceipt
  linkedCashTransactionId: string | null
}

function parsedFromRow(row: {
  extracted_data?: unknown
  raw_body_text?: string | null
  received_at?: string | null
}): ParsedWellsFargoAtmReceipt {
  const extra = row.extracted_data
  const atm =
    extra && typeof extra === 'object' && extra !== null && 'atm' in extra
      ? (extra as { atm?: ParsedWellsFargoAtmReceipt }).atm
      : null
  if (atm && typeof atm === 'object') {
    return {
      amount: atm.amount ?? null,
      depositDateYmd: atm.depositDateYmd ?? null,
      transactionNumber: atm.transactionNumber ?? null,
      atmId: atm.atmId ?? null,
      last4: atm.last4 ?? null,
      toAccount: atm.toAccount ?? null,
    }
  }
  return parseWellsFargoAtmReceipt(row.raw_body_text, null)
}

function itemDateYmd(item: { parsed: ParsedWellsFargoAtmReceipt; receivedAt: string | null }): string {
  if (item.parsed.depositDateYmd) return item.parsed.depositDateYmd
  const received = item.receivedAt
  if (!received) return ''
  return received.slice(0, 10)
}

export function isAtmReceiptInDateWindow(item: AtmReceiptListItem, dateYmd: string, days = ATM_RECEIPT_DAY_WINDOW): boolean {
  if (!dateYmd) return true
  const emailDate = itemDateYmd(item)
  if (!emailDate) return false
  const start = addCalendarDaysYmd(dateYmd, -days)
  const end = addCalendarDaysYmd(dateYmd, days)
  return emailDate >= start && emailDate <= end
}

export async function listAtmReceiptImports(
  client: SupabaseClient,
  opts?: { dateYmd?: string; linkedImportId?: string | null }
): Promise<AtmReceiptListItem[]> {
  const dateYmd = opts?.dateYmd?.trim() || ''
  const start = dateYmd ? addCalendarDaysYmd(dateYmd, -ATM_RECEIPT_DAY_WINDOW) : ''
  const end = dateYmd ? addCalendarDaysYmd(dateYmd, ATM_RECEIPT_DAY_WINDOW) : ''

  let query = client
    .from('reservation_imports')
    .select('id, subject, source_email, received_at, platform_key, extracted_data, raw_body_text')
    .ilike('subject', '%ATM Receipt%')
    .order('received_at', { ascending: false })
    .limit(200)

  if (start && end) {
    query = query
      .gte('received_at', `${start}T00:00:00.000Z`)
      .lte('received_at', `${end}T23:59:59.999Z`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[atm-receipt] list imports:', error.message)
    throw new Error(error.message)
  }

  let rows = data ?? []
  const linkedImportId = opts?.linkedImportId?.trim() || ''
  if (linkedImportId && !rows.some((row) => row.id === linkedImportId)) {
    const { data: linkedRow } = await client
      .from('reservation_imports')
      .select('id, subject, source_email, received_at, platform_key, extracted_data, raw_body_text')
      .eq('id', linkedImportId)
      .maybeSingle()
    if (linkedRow) rows = [linkedRow, ...rows]
  }

  const filtered = rows.filter((row) =>
    isWellsFargoAtmReceiptEmail({
      subject: row.subject,
      from: row.source_email,
      platformKey: row.platform_key,
      body: String(row.raw_body_text ?? ''),
    })
  )

  const ids = filtered.map((r) => r.id)
  const linked = new Map<string, string>()
  if (ids.length > 0) {
    const { data: txs, error: txErr } = await fromUntypedTable(client, 'cash_transactions')
      .select('id, atm_receipt_import_id')
      .in('atm_receipt_import_id', ids)
    if (txErr) {
      console.error('[atm-receipt] linked cash:', txErr.message)
    }
    for (const tx of txs ?? []) {
      const importId = String((tx as { atm_receipt_import_id?: string | null }).atm_receipt_import_id ?? '')
      const txId = String((tx as { id?: string }).id ?? '')
      if (importId && txId) linked.set(importId, txId)
    }
  }

  return filtered.map((row) => ({
    id: row.id,
    subject: row.subject,
    from: row.source_email,
    receivedAt: row.received_at,
    parsed: parsedFromRow(row),
    linkedCashTransactionId: linked.get(row.id) ?? null,
  }))
}
