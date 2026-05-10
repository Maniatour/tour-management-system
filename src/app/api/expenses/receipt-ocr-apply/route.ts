import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { createClient } from '@/lib/supabase/server'
import { TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR } from '@/lib/tourExpenseConstants'
import {
  extractReceiptOcrFromImageBuffer,
  resolvePaymentMethodIdFromOcrCandidates,
  type PaymentMethodOcrOption,
  type ReceiptOcrCandidates,
} from '@/lib/receiptOcrExtract'
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay'
import { fetchReceiptOcrParseRuntime } from '@/lib/receiptOcrParseRules'

export const runtime = 'nodejs'
export const maxDuration = 120

type TeamRow = {
  email: string
  name_ko: string | null
  name_en: string | null
  nick_name: string | null
}

async function loadPaymentMethodOcrOptions(supabase: Awaited<ReturnType<typeof createClient>>): Promise<PaymentMethodOcrOption[]> {
  const { data: pmRows, error: pmErr } = await supabase
    .from('payment_methods')
    .select('id, method, method_type, display_name, user_email, status, card_holder_name')
    .order('method')
  if (pmErr || !pmRows?.length) return []

  const { data: teamData } = await supabase.from('team').select('email, name_ko, name_en, nick_name')
  const teamByEmailLower = new Map<string, TeamRow>()
  for (const r of (teamData || []) as TeamRow[]) {
    teamByEmailLower.set(String(r.email).toLowerCase(), r)
  }

  const options: PaymentMethodOcrOption[] = []
  for (const pm of pmRows as Array<{
    id: string
    method: string
    method_type: string | null
    display_name: string | null
    user_email: string | null
    status: string | null
    card_holder_name: string | null
  }>) {
    const em = pm.user_email ? String(pm.user_email).toLowerCase() : ''
    const team = em ? teamByEmailLower.get(em) : undefined
    const name = formatPaymentMethodDisplay(
      {
        id: pm.id,
        method: pm.method,
        display_name: pm.display_name,
        user_email: pm.user_email,
        card_holder_name: pm.card_holder_name,
      },
      team
    )
    options.push({
      id: pm.id,
      name,
      method: pm.method,
      status: pm.status,
    })
  }
  return options
}

function buildDraftNote(candidates: ReceiptOcrCandidates): string {
  const base = 'Receipt uploaded first; expense details pending.'
  const lines: string[] = [base]
  const pt = (candidates.paid_to || '').trim()
  if (pt) lines.push(`[OCR] Vendor: ${pt.slice(0, 200)}`)
  if (candidates.amount != null && candidates.amount > 0) {
    lines.push(`[OCR] Amount: ${candidates.amount.toFixed(2)}`)
  }
  if (candidates.date) lines.push(`[OCR] Date: ${candidates.date}`)
  const cat = (candidates.paid_for || '').trim()
  if (cat) lines.push(`[OCR] Category guess: ${cat}`)
  return lines.join('\n')
}

function hasOcrSignal(text: string, candidates: ReceiptOcrCandidates): boolean {
  if (text.trim().length >= 24) return true
  if ((candidates.paid_to || '').trim().length >= 3) return true
  if (candidates.amount != null && candidates.amount > 0) return true
  if (candidates.date) return true
  if ((candidates.paid_for || '').trim().length > 0) return true
  if ((candidates.payment_method_id || '').trim().length > 0) return true
  return false
}

/** 공개 URL fetch 실패 시(404 등) 세션으로 Storage 직접 다운로드 */
async function loadReceiptImageBuffer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  imageUrl: string,
  filePath: string | null | undefined
): Promise<Buffer | null> {
  try {
    const remote = await fetch(imageUrl)
    if (remote.ok) {
      const buf = Buffer.from(await remote.arrayBuffer())
      if (buf.length > 0) return buf
    }
  } catch {
    /* fall through */
  }
  const fp = typeof filePath === 'string' ? filePath.trim() : ''
  if (!fp) return null
  const { data, error } = await supabase.storage.from('tour-expenses').download(fp)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const expenseId = typeof body?.expenseId === 'string' ? body.expenseId.trim() : ''
    if (!expenseId) {
      return NextResponse.json({ error: 'expenseId is required' }, { status: 400 })
    }

    const { data: row, error: selErr } = await supabase
      .from('tour_expenses')
      .select('id, paid_for, image_url, file_path, submitted_by, tour_id')
      .eq('id', expenseId)
      .maybeSingle()

    if (selErr || !row) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    if (row.paid_for !== TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR) {
      return NextResponse.json({ error: 'Not a receipt-pending expense' }, { status: 400 })
    }

    const imageUrl = typeof row.image_url === 'string' ? row.image_url.trim() : ''
    if (!imageUrl) {
      return NextResponse.json({ error: 'No receipt image on this expense' }, { status: 400 })
    }

    const imageBuffer = await loadReceiptImageBuffer(supabase, imageUrl, row.file_path)
    if (!imageBuffer || imageBuffer.length === 0) {
      return NextResponse.json({ ok: false, skipped: 'image_fetch_failed' }, { status: 200 })
    }
    let text: string
    let candidates: ReceiptOcrCandidates
    try {
      const ocrRuntime = await fetchReceiptOcrParseRuntime(supabase)
      const ocr = await extractReceiptOcrFromImageBuffer(imageBuffer, { runtime: ocrRuntime })
      text = ocr.text
      candidates = ocr.candidates
    } catch (e) {
      console.error('receipt-ocr-apply OCR error:', e)
      return NextResponse.json({ ok: false, skipped: 'ocr_failed' }, { status: 200 })
    }

    if (!hasOcrSignal(text, candidates)) {
      const { data: fresh } = await supabase.from('tour_expenses').select('*').eq('id', expenseId).single()
      return NextResponse.json({ ok: false, skipped: 'low_signal', expense: fresh }, { status: 200 })
    }

    const pmOptions = await loadPaymentMethodOcrOptions(supabase)
    const paymentMethodId = resolvePaymentMethodIdFromOcrCandidates(candidates, pmOptions)

    const paidToTrim = (candidates.paid_to || '').trim()
    const amount =
      candidates.amount != null && Number.isFinite(candidates.amount) && candidates.amount > 0
        ? candidates.amount
        : 0

    const updatePayload = {
      paid_to: paidToTrim.length > 0 ? paidToTrim.slice(0, 500) : null,
      amount,
      payment_method: paymentMethodId ?? null,
      paid_for: TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR,
      note: buildDraftNote(candidates),
    }

    const { data: updated, error: updErr } = await supabase
      .from('tour_expenses')
      .update(updatePayload)
      .eq('id', expenseId)
      .select('*')
      .single()

    if (updErr) {
      console.error('receipt-ocr-apply update error:', updErr)
      return NextResponse.json({ error: updErr.message || 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      expense: updated,
      ocr: { candidates, textLength: text.length },
    })
  } catch (error) {
    console.error('receipt-ocr-apply:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'receipt-ocr-apply failed' },
      { status: 500 }
    )
  }
}
