import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/**
 * 카드 대금을 은행에서 납부할 때의 분개 (비용 아님).
 * 차변: 카드 미지급(신용카드 계정) / 대변: 은행 — 합계 일치.
 * Tenancy: stamp operator_id from financial_accounts (no booking/payment logic change).
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

    const { data: accounts, error: accErr } = await fromUntypedTable(supabase, 'financial_accounts')
      .select('id, operator_id')
      .in('id', [bankFinancialAccountId, cardFinancialAccountId])

    if (accErr) {
      return NextResponse.json({ error: accErr.message || '금융 계정 조회 실패' }, { status: 500 })
    }

    const rows = (accounts || []) as { id: string; operator_id: string | null }[]
    const bank = rows.find((r) => r.id === bankFinancialAccountId)
    const card = rows.find((r) => r.id === cardFinancialAccountId)
    if (!bank || !card) {
      return NextResponse.json({ error: '은행 또는 카드 금융 계정을 찾을 수 없습니다.' }, { status: 400 })
    }

    const bankOp = bank.operator_id || KOVEgAS_OPERATOR_ID
    const cardOp = card.operator_id || KOVEgAS_OPERATOR_ID
    if (bankOp !== cardOp) {
      return NextResponse.json(
        { error: '은행·카드 계정의 operator_id가 다릅니다. 동일 테넌트 계정만 분개할 수 있습니다.' },
        { status: 400 }
      )
    }
    const operatorId = bankOp

    const { data: entry, error: e1 } = await fromUntypedTable(supabase, 'journal_entries')
      .insert({
        entry_date: entryDate,
        memo: memo || 'Card payment from bank',
        source: 'card_payment_transfer',
        created_by: createdBy || null,
        operator_id: operatorId,
      } as never)
      .select('id')
      .single()

    if (e1 || !entry) {
      return NextResponse.json({ error: e1?.message || '분개 헤더 실패' }, { status: 500 })
    }

    const jid = (entry as { id: string }).id

    const { error: e2 } = await fromUntypedTable(supabase, 'journal_lines').insert([
      {
        journal_entry_id: jid,
        financial_account_id: cardFinancialAccountId,
        debit: amt,
        credit: 0,
        line_memo: 'Reduce card payable',
        operator_id: operatorId,
      },
      {
        journal_entry_id: jid,
        financial_account_id: bankFinancialAccountId,
        debit: 0,
        credit: amt,
        line_memo: 'Bank outflow',
        operator_id: operatorId,
      },
    ] as never)

    if (e2) {
      return NextResponse.json({ error: e2.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, journal_entry_id: jid })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
