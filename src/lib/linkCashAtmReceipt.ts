import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/database.types'
import { replaceExpenseReconciliationMatch } from '@/lib/expense-reconciliation-similar-lines'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  addCalendarDaysYmd,
  cashTransactionDateYmd,
  isWellsFargoAtmReceiptEmail,
  parseWellsFargoAtmReceipt,
  atmToAccountLinkError,
  WELLS_FARGO_ATM_PLATFORM_KEY,
  type ParsedWellsFargoAtmReceipt,
} from '@/lib/wellsFargoAtmReceipt'

function mergeExtractedAtm(existing: unknown, parsed: ParsedWellsFargoAtmReceipt): Json {
  const prev =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  return {
    ...prev,
    is_booking_confirmed: false,
    atm: parsed,
  } as Json
}

async function tryLinkStatementInflow(
  client: SupabaseClient,
  params: {
    cashTransactionId: string
    amount: number
    depositDateYmd: string
    actorEmail: string
    operatorId: string
  }
): Promise<string | null> {
  const start = addCalendarDaysYmd(params.depositDateYmd, -2)
  const end = addCalendarDaysYmd(params.depositDateYmd, 2)
  const { data, error } = await fromUntypedTable(client, 'statement_lines')
    .select('id, posted_date, amount, direction, description, merchant, matched_status')
    .eq('operator_id', params.operatorId)
    .eq('direction', 'inflow')
    .gte('posted_date', start)
    .lte('posted_date', end)
    .in('matched_status', ['unmatched', 'partial'])
    .limit(80)
  if (error) {
    console.error('[atm-receipt] statement_lines:', error.message)
    return null
  }

  const scored = (data ?? [])
    .map((line) => {
      const amt = Math.abs(Number((line as { amount?: number }).amount ?? 0))
      const amountDiff = Math.abs(amt - params.amount)
      if (amountDiff > 0.51) return null
      const hay = `${(line as { merchant?: string }).merchant ?? ''} ${(line as { description?: string }).description ?? ''}`.toLowerCase()
      let score = amountDiff < 0.02 ? 40 : 20
      if (/\batm\b|\bdeposit\b/.test(hay)) score += 25
      if (/wells\s*fargo/.test(hay)) score += 10
      return { id: String((line as { id: string }).id), amount: amt, score }
    })
    .filter((x): x is { id: string; amount: number; score: number } => x != null)
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score < 40) return null

  try {
    await replaceExpenseReconciliationMatch(client, {
      actorEmail: params.actorEmail,
      sourceTable: 'cash_transactions',
      sourceId: params.cashTransactionId,
      statementLineId: best.id,
      statementLineAmount: best.amount,
      matchedAmount: params.amount,
      linkMode: 'replace',
      matchKind: 'auto',
      operatorId: params.operatorId,
    })
    return best.id
  } catch (e) {
    console.error('[atm-receipt] statement link', e)
    return null
  }
}

export async function linkAtmReceiptToCashTransaction(
  client: SupabaseClient,
  params: {
    importId: string
    cashTransactionId: string
    actorEmail: string
  }
): Promise<{ error?: string; statementLinked: boolean }> {
  const { data: cash, error: cashErr } = await fromUntypedTable(client, 'cash_transactions')
    .select('id, amount, transaction_date, description, operator_id, atm_receipt_import_id')
    .eq('id', params.cashTransactionId)
    .maybeSingle()
  if (cashErr) return { error: cashErr.message, statementLinked: false }
  if (!cash) return { error: '현금 거래를 찾을 수 없습니다.', statementLinked: false }

  const { data: imp, error: impErr } = await client
    .from('reservation_imports')
    .select('id, subject, source_email, raw_body_text, raw_body_html, platform_key, extracted_data')
    .eq('id', params.importId)
    .maybeSingle()
  if (impErr) return { error: impErr.message, statementLinked: false }
  if (!imp) return { error: 'ATM 메일을 찾을 수 없습니다.', statementLinked: false }
  if (
    !isWellsFargoAtmReceiptEmail({
      subject: imp.subject,
      from: imp.source_email,
      platformKey: imp.platform_key,
      body: String(imp.raw_body_text ?? imp.raw_body_html ?? ''),
    })
  ) {
    return { error: 'Wells Fargo ATM Receipt 메일이 아닙니다.', statementLinked: false }
  }

  const { data: taken } = await fromUntypedTable(client, 'cash_transactions')
    .select('id')
    .eq('atm_receipt_import_id', params.importId)
    .neq('id', params.cashTransactionId)
    .maybeSingle()
  if (taken?.id) {
    return { error: '이 메일은 다른 은행 Deposit에 이미 연결되어 있습니다.', statementLinked: false }
  }

  const parsed = parseWellsFargoAtmReceipt(imp.raw_body_text, imp.raw_body_html)
  const toError = atmToAccountLinkError(parsed)
  if (toError) return { error: toError, statementLinked: false }

  const { error: updErr } = await fromUntypedTable(client, 'cash_transactions')
    .update({
      atm_receipt_import_id: params.importId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.cashTransactionId)
  if (updErr) return { error: updErr.message, statementLinked: false }

  await client
    .from('reservation_imports')
    .update({
      platform_key: WELLS_FARGO_ATM_PLATFORM_KEY,
      extracted_data: mergeExtractedAtm(imp.extracted_data, parsed),
      status: 'confirmed',
    })
    .eq('id', params.importId)

  const amount = parsed.amount ?? Math.abs(Number(cash.amount ?? 0))
  const depositDateYmd = parsed.depositDateYmd || cashTransactionDateYmd(cash.transaction_date)
  let statementLinked = false
  if (amount > 0 && depositDateYmd) {
    const lineId = await tryLinkStatementInflow(client, {
      cashTransactionId: params.cashTransactionId,
      amount,
      depositDateYmd,
      actorEmail: params.actorEmail,
      operatorId: resolveOperatorId(cash.operator_id),
    })
    statementLinked = Boolean(lineId)
  }
  return { statementLinked }
}

export async function unlinkAtmReceiptFromCashTransaction(
  client: SupabaseClient,
  cashTransactionId: string
): Promise<{ error?: string }> {
  const { error } = await fromUntypedTable(client, 'cash_transactions')
    .update({
      atm_receipt_import_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cashTransactionId)
  if (error) return { error: error.message }
  return {}
}
