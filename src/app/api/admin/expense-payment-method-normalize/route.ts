import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildNormalizePreview,
  type ExpenseTableName,
  type PaymentMethodRow,
} from '@/lib/expensePaymentMethodNormalize'

const TABLES: ExpenseTableName[] = ['reservation_expenses', 'company_expenses', 'tour_expenses']

async function aggregateWithKeyset(
  table: ExpenseTableName
): Promise<Array<{ source_table: string; payment_method: string; row_count: number }>> {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY 없음')
  const counts = new Map<string, number>()
  let lastId: string | null = null
  const page = 2500
  for (;;) {
    let q = supabaseAdmin.from(table).select('id, payment_method').order('id').limit(page)
    if (lastId) q = q.gt('id', lastId)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    for (const row of data) {
      const v =
        typeof row.payment_method === 'string' ? row.payment_method.trim() : ''
      if (!v) continue
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    lastId = data[data.length - 1].id as string
    if (data.length < page) break
  }
  return Array.from(counts.entries()).map(([payment_method, row_count]) => ({
    source_table: table,
    payment_method,
    row_count,
  }))
}

async function loadStats(): Promise<
  Array<{ source_table: string; payment_method: string; row_count: number }>
> {
  if (!supabaseAdmin) {
    throw new Error('서비스 롤 키가 설정되지 않았습니다.')
  }

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('expense_payment_method_stats')
  if (!rpcError && rpcData && Array.isArray(rpcData)) {
    return rpcData as Array<{ source_table: string; payment_method: string; row_count: number }>
  }

  const merged: Array<{ source_table: string; payment_method: string; row_count: number }> = []
  for (const t of TABLES) {
    merged.push(...(await aggregateWithKeyset(t)))
  }
  return merged
}

/**
 * GET: 지출 테이블별 payment_method 분포 + 정규화 미리보기
 */
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          message:
            'SUPABASE_SERVICE_ROLE_KEY가 없어 집계를 실행할 수 없습니다. 서버 환경 변수를 확인하세요.',
        },
        { status: 503 }
      )
    }

    const stats = await loadStats()

    const { data: pmData, error: pmErr } = await supabaseAdmin
      .from('payment_methods')
      .select('id, method, display_name, card_holder_name, user_email')
      .order('method')

    if (pmErr) {
      return NextResponse.json(
        { success: false, message: pmErr.message },
        { status: 500 }
      )
    }

    const paymentMethods = (pmData || []) as PaymentMethodRow[]
    const preview = buildNormalizePreview(stats, paymentMethods)

    const summary = {
      totalDistinctValues: preview.length,
      registered: preview.filter((p) => p.status === 'registered').length,
      aliasSuggested: preview.filter((p) => p.status === 'alias_suggested').length,
      unregistered: preview.filter((p) => p.status === 'unregistered').length,
    }

    return NextResponse.json({
      success: true,
      stats,
      paymentMethods,
      preview,
      summary,
    })
  } catch (e) {
    console.error('expense-payment-method-normalize GET:', e)
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : '집계 실패',
      },
      { status: 500 }
    )
  }
}

type MappingBody = {
  table: ExpenseTableName
  from: string
  to: string
}

function isExpenseTable(s: string): s is ExpenseTableName {
  return TABLES.includes(s as ExpenseTableName)
}

/**
 * POST: payment_method 값 치환 (from → to), 동일 문자열 전체 행
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'SUPABASE_SERVICE_ROLE_KEY가 없습니다.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const mappings: MappingBody[] = Array.isArray(body?.mappings) ? body.mappings : []

    if (mappings.length === 0) {
      return NextResponse.json({ success: false, message: 'mappings 배열이 필요합니다.' }, { status: 400 })
    }

    const results: Array<{
      table: ExpenseTableName
      from: string
      to: string
      updated: number
      error?: string
    }> = []

    for (const m of mappings) {
      if (!m || typeof m !== 'object') continue
      const { table, from, to } = m
      const tableStr = typeof table === 'string' ? table : ''
      if (!isExpenseTable(tableStr)) {
        results.push({
          table: 'reservation_expenses',
          from: String(from ?? ''),
          to: String(to ?? ''),
          updated: 0,
          error: `invalid_table:${tableStr}`,
        })
        continue
      }
      const tbl = tableStr as ExpenseTableName
      const fromStr = typeof from === 'string' ? from.trim() : ''
      const toStr = typeof to === 'string' ? to.trim() : ''
      if (!fromStr || !toStr) {
        results.push({ table: tbl, from: fromStr, to: toStr, updated: 0, error: 'empty_from_or_to' })
        continue
      }
      if (fromStr === toStr) {
        results.push({ table: tbl, from: fromStr, to: toStr, updated: 0, error: 'no_op' })
        continue
      }

      const { error, count } = await supabaseAdmin
        .from(tbl)
        .update({ payment_method: toStr })
        .eq('payment_method', fromStr)
        .select('*', { count: 'exact', head: true })

      if (error) {
        results.push({ table: tbl, from: fromStr, to: toStr, updated: 0, error: error.message })
      } else {
        results.push({ table: tbl, from: fromStr, to: toStr, updated: count ?? 0 })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (e) {
    console.error('expense-payment-method-normalize POST:', e)
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : '업데이트 실패',
      },
      { status: 500 }
    )
  }
}
