import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 카드 대금을 은행에서 납부할 때의 분개 (비용 아님).
 * 차변: 카드 미지급(신용카드 계정) / 대변: 은행 — 합계 일치.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const {
      entryDate,
      memo,
      bankFinancialAccountId,
      cardFinancialAccountId,
      amount,
      createdBy
    } = body as {
      entryDate?: string
      memo?: string
      bankFinancialAccountId?: string
      cardFinancialAccountId?: string
      amount?: number
      createdBy?: string
    }

    const amt = Number(amount)
    if (!entryDate || !bankFinancialAccountId || !cardFinancialAccountId || !Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'entryDate, bankFinancialAccountId, cardFinancialAccountId, amount 필요' }, { status: 400 })
    }

    const { data: entry, error: e1 } = await supabase
      .from('journal_entries')
      .insert({
        entry_date: entryDate,
        memo: memo || 'Card payment from bank',
        source: 'card_payment_transfer',
        created_by: createdBy || null
      })
      .select('id')
      .single()

    if (e1 || !entry?.id) {
      return NextResponse.json({ error: e1?.message || '분개 헤더 실패' }, { status: 500 })
    }

    const jid = entry.id as string

    const { error: e2 } = await supabase.from('journal_lines').insert([
      {
        journal_entry_id: jid,
        financial_account_id: cardFinancialAccountId,
        debit: amt,
        credit: 0,
        line_memo: 'Reduce card payable'
      },
      {
        journal_entry_id: jid,
        financial_account_id: bankFinancialAccountId,
        debit: 0,
        credit: amt,
        line_memo: 'Bank outflow'
      }
    ])

    if (e2) {
      return NextResponse.json({ error: e2.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, journal_entry_id: jid })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
