import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PAYMENT_METHOD_REF_TABLES, type PaymentMethodRefTable } from '@/lib/paymentMethodRefTables'

export { PAYMENT_METHOD_REF_TABLES, type PaymentMethodRefTable }

function parseSourceIds(param: string | null): string[] {
  if (!param || !param.trim()) return []
  return param
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * GET: 통합 전 참조 건수 미리보기 (source별·테이블별)
 */
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'SUPABASE_SERVICE_ROLE_KEY가 없습니다.' },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sources = parseSourceIds(searchParams.get('sources'))

    if (sources.length === 0) {
      return NextResponse.json(
        { success: false, message: 'sources 쿼리(쉼표 구분 id 목록)가 필요합니다.' },
        { status: 400 }
      )
    }

    const perSource: Record<string, Record<string, number>> = {}
    let total = 0

    for (const sid of sources) {
      perSource[sid] = {}
      for (const table of PAYMENT_METHOD_REF_TABLES) {
        const { count, error } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('payment_method', sid)

        if (error) {
          console.warn(`merge preview ${table}:`, error.message)
          perSource[sid][table] = -1
        } else {
          const c = count ?? 0
          perSource[sid][table] = c
          total += c
        }
      }
    }

    return NextResponse.json({ success: true, perSource, total })
  } catch (e) {
    console.error('payment-methods merge GET:', e)
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : '미리보기 실패' },
      { status: 500 }
    )
  }
}

type MergeBody = {
  targetId?: string
  sourceIds?: string[]
  deleteSources?: boolean
}

/**
 * POST: source 결제 방법 ID들을 target 하나로 합침 — 모든 참조 테이블의 payment_method 갱신
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'SUPABASE_SERVICE_ROLE_KEY가 없습니다.' },
        { status: 503 }
      )
    }

    const body = (await request.json()) as MergeBody
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : ''
    const sourceIds = Array.isArray(body.sourceIds)
      ? [...new Set(body.sourceIds.map((s) => String(s).trim()).filter(Boolean))]
      : []
    const deleteSources = Boolean(body.deleteSources)

    if (!targetId) {
      return NextResponse.json({ success: false, message: 'targetId가 필요합니다.' }, { status: 400 })
    }
    if (sourceIds.length === 0) {
      return NextResponse.json({ success: false, message: 'sourceIds가 필요합니다.' }, { status: 400 })
    }
    if (sourceIds.includes(targetId)) {
      return NextResponse.json(
        { success: false, message: '통합 대상(target)은 source 목록에 포함할 수 없습니다.' },
        { status: 400 }
      )
    }

    const { data: targetRow, error: tErr } = await supabaseAdmin
      .from('payment_methods')
      .select('id')
      .eq('id', targetId)
      .maybeSingle()

    if (tErr || !targetRow) {
      return NextResponse.json(
        { success: false, message: '유지할 결제 방법(target)을 찾을 수 없습니다.' },
        { status: 400 }
      )
    }

    const { data: sourceRows, error: sErr } = await supabaseAdmin
      .from('payment_methods')
      .select('id')
      .in('id', sourceIds)

    if (sErr) {
      return NextResponse.json({ success: false, message: sErr.message }, { status: 500 })
    }
    const found = new Set((sourceRows || []).map((r: { id: string }) => r.id))
    const missing = sourceIds.filter((id) => !found.has(id))
    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `다음 ID는 payment_methods에 없습니다: ${missing.join(', ')}`,
        },
        { status: 400 }
      )
    }

    const updatesByTable: Record<string, number> = {}
    for (const t of PAYMENT_METHOD_REF_TABLES) updatesByTable[t] = 0

    for (const sourceId of sourceIds) {
      for (const table of PAYMENT_METHOD_REF_TABLES) {
        const { error, count } = await supabaseAdmin
          .from(table)
          .update({ payment_method: targetId })
          .eq('payment_method', sourceId)
          .select('*', { count: 'exact', head: true })

        if (error) {
          return NextResponse.json(
            {
              success: false,
              message: `${table} 업데이트 실패: ${error.message}`,
              partialUpdates: updatesByTable,
            },
            { status: 500 }
          )
        }
        updatesByTable[table] += count ?? 0
      }
    }

    let deleted = 0
    if (deleteSources) {
      const { error: delErr, data: delData } = await supabaseAdmin
        .from('payment_methods')
        .delete()
        .in('id', sourceIds)
        .select('id')

      if (delErr) {
        return NextResponse.json(
          {
            success: false,
            message: `참조는 옮겼으나 원본 결제 방법 삭제 실패: ${delErr.message}`,
            updatesByTable,
          },
          { status: 500 }
        )
      }
      deleted = delData?.length ?? 0
    }

    const totalUpdated = Object.values(updatesByTable).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      targetId,
      sourceIds,
      updatesByTable,
      totalUpdated,
      deletedSourceRows: deleted,
      deleteSourcesAttempted: deleteSources,
    })
  } catch (e) {
    console.error('payment-methods merge POST:', e)
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : '통합 실패' },
      { status: 500 }
    )
  }
}
