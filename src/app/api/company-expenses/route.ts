import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { buildCompanyExpenseSearchOrClause } from '@/lib/companyExpenseSearch'
import { buildCompanyExpenseStandardLeafOrClause } from '@/lib/companyExpenseStandardLeafFilter'
import { lvSubmitOnBoundsFromYmdFilter } from '@/lib/lasVegasCalendar'
import { softDeleteExpenseRecord } from '@/lib/expense-soft-delete'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import { Database } from '@/lib/database.types'
import { applyCompanyExpenseVehicleMileage } from '@/lib/companyExpenseVehicleMileage'
import { parseMultiQueryValues } from '@/lib/multiQueryParam'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { lookupVehicleOperatorId } from '@/lib/operators/lookupVehicleOperatorId'

type CompanyExpenseInsert = Database['public']['Tables']['company_expenses']['Insert']

type CompanyExpenseListFilterParams = {
  categories: string[]
  statuses: string[]
  vehicleIds: string[]
  dateFrom: string | null
  dateTo: string | null
  paidForValues: string[]
  paidToValues: string[]
  standardPaidForValues: string[]
  paymentMethodIds: string[]
  submitByEmails: string[]
  standardPaidFor: string | null
  reimbursement: string
  standardLeafId: string
}

/** 검색·페이지 제외 목록 필터 (금액 스캔·본 조회 공통) */
async function applyCompanyExpenseListFilters(
  supabase: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  params: CompanyExpenseListFilterParams
): Promise<{ query: typeof query; empty?: boolean }> {
  let q = query

  if (params.categories.length > 0) {
    q = q.in('category', params.categories)
  }
  if (params.statuses.length > 0) {
    q = q.in('status', params.statuses)
  }
  if (params.vehicleIds.length > 0) {
    q = q.in('vehicle_id', params.vehicleIds)
  }
  if (params.paidForValues.length > 0) {
    q = q.in('paid_for', params.paidForValues)
  }
  if (params.paidToValues.length > 0) {
    q = q.in('paid_to', params.paidToValues)
  }
  if (params.standardPaidForValues.length > 0) {
    q = q.in('standard_paid_for', params.standardPaidForValues)
  } else if (params.standardPaidFor === 'set') {
    q = q.not('standard_paid_for', 'is', null).neq('standard_paid_for', '')
  } else if (params.standardPaidFor === 'unset') {
    q = q.or('standard_paid_for.is.null,standard_paid_for.eq.')
  }
  if (params.paymentMethodIds.length > 0) {
    q = q.in('payment_method', params.paymentMethodIds)
  }
  if (params.submitByEmails.length > 0) {
    q = q.in('submit_by', params.submitByEmails)
  }
  const submitOnBounds = lvSubmitOnBoundsFromYmdFilter(params.dateFrom, params.dateTo)
  if (submitOnBounds.gte) {
    q = q.gte('submit_on', submitOnBounds.gte)
  }
  if (submitOnBounds.lte) {
    q = q.lte('submit_on', submitOnBounds.lte)
  }

  if (params.reimbursement === 'employee_card') {
    const { data: pmRows } = await supabase
      .from('payment_methods')
      .select('id')
      .not('user_email', 'is', null)
    const pmIds = [...new Set((pmRows || []).map((r: { id: string }) => r.id).filter(Boolean))]
    if (pmIds.length === 0) return { query: q, empty: true }
    q = q.in('payment_method', pmIds)
  } else if (params.reimbursement === 'outstanding') {
    q = q.gt('reimbursement_outstanding', 0.009)
  }

  if (params.standardLeafId) {
    const [{ data: catRows, error: catErr }, { data: mappingRows, error: mapErr }] = await Promise.all([
      supabase
        .from('expense_standard_categories')
        .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
        .order('display_order', { ascending: true }),
      supabase
        .from('expense_category_mappings')
        .select('original_value, source_table, standard_category_id, sub_category_id')
        .eq('source_table', 'company_expenses'),
    ])

    if (catErr || mapErr) {
      throw new Error('표준 카테고리 필터를 적용할 수 없습니다.')
    }

    const orClause = buildCompanyExpenseStandardLeafOrClause(
      params.standardLeafId,
      (catRows ?? []) as ExpenseStandardCategoryPickRow[],
      mappingRows ?? []
    )

    if (!orClause) return { query: q, empty: true }
    q = q.or(orClause)
  }

  return { query: q }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const { searchParams } = new URL(request.url)
    
    // 쿼리 파라미터 추출
    const search = searchParams.get('search')
    const categories = parseMultiQueryValues(searchParams, 'category')
    const statuses = parseMultiQueryValues(searchParams, 'status')
    const vehicleIds = parseMultiQueryValues(searchParams, 'vehicle_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const paidForValues = parseMultiQueryValues(searchParams, 'paid_for')
    const paidToValues = parseMultiQueryValues(searchParams, 'paid_to')
    const standardPaidForValues = parseMultiQueryValues(searchParams, 'standard_paid_for')
    const paymentMethodIds = parseMultiQueryValues(searchParams, 'payment_method')
    const submitByEmails = parseMultiQueryValues(searchParams, 'submit_by')
    /** all 외: set = standard_paid_for 있음, unset = 없음(null) — 값 다중 선택과 분리 */
    const standardPaidForPresence = (searchParams.get('standard_paid_for_presence') || '').trim().toLowerCase()
    /** all | employee_card | outstanding */
    const reimbursement = (searchParams.get('reimbursement') || 'all').toLowerCase()
    /** all | unmatched — unmatched: reconciliation_matches에 없는 지출만(뷰) */
    const statementMatch = (searchParams.get('statement_match') || 'all').toLowerCase()
    /** 카테고리 매니저 표준 리프 id — 매핑·standard_paid_for·폼 역매칭과 일치하는 지출만 */
    const standardLeafId = (searchParams.get('standard_leaf_id') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '20', 10)))
    const from = (page - 1) * limit
    const to = from + limit - 1
    const operatorId = resolveOperatorId(searchParams.get('operatorId'))

    const searchTrimmed = (search ?? '').trim()
    const searchActive = searchTrimmed.length > 0

    /** 검색어가 있으면 «미대조만» 뷰를 쓰지 않음 — 이미 명세에 연결된 지출도 찾을 수 있게 */
    const expenseTable =
      searchActive || statementMatch !== 'unmatched'
        ? 'company_expenses'
        : 'company_expenses_no_statement_match'

    const listFilterParams: CompanyExpenseListFilterParams = {
      categories,
      statuses,
      vehicleIds,
      dateFrom,
      dateTo,
      paidForValues,
      paidToValues,
      standardPaidForValues,
      paymentMethodIds,
      submitByEmails,
      standardPaidFor:
        standardPaidForPresence === 'set' || standardPaidForPresence === 'unset'
          ? standardPaidForPresence
          : null,
      reimbursement,
      standardLeafId,
    }

    /** 검색 시 OR·ilike·exact count가 무거워 planned 카운트로 첫 응답 지연 완화 */
    let query = fromUntypedTable(supabase, expenseTable)
      .select('*', { count: searchActive ? 'planned' : 'exact' })
      .is('deleted_at', null)
      .eq('operator_id', operatorId)

    try {
      const filtered = await applyCompanyExpenseListFilters(supabase, query, listFilterParams)
      if (filtered.empty) {
        return NextResponse.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 1 },
        })
      }
      query = filtered.query
    } catch (filterErr) {
      console.error('표준 카테고리 필터 로드 오류:', filterErr)
      return NextResponse.json({ error: '표준 카테고리 필터를 적용할 수 없습니다.' }, { status: 500 })
    }

    if (searchActive) {
      const searchOr = await buildCompanyExpenseSearchOrClause(supabase, searchTrimmed)
      if (searchOr) {
        query = query.or(searchOr)
      }
    }

    query = query.order('submit_on', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    
    if (error) {
      console.error('회사 지출 조회 오류:', error)
      return NextResponse.json({ error: '회사 지출을 조회할 수 없습니다.' }, { status: 500 })
    }
    
    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / limit))
    
    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })
  } catch (error) {
    console.error('회사 지출 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const body = await request.json()
    
    const {
      id,
      paid_to,
      paid_for,
      description,
      amount,
      payment_method,
      submit_by,
      submit_on,
      photo_url,
      category,
      subcategory,
      vehicle_id,
      maintenance_type,
      notes,
      attachments,
      expense_type,
      tax_deductible,
      paid_for_label_id,
      standard_paid_for: standardPaidForBody,
      reimbursed_amount: reimbursedAmountBody,
      reimbursed_on: reimbursedOnBody,
      reimbursement_note: reimbursementNoteBody,
      mileage,
    } = body
    
    // 필수: 결제처·금액·제출자·결제수단 (paid_for는 선택 — 빈 문자열 저장 가능)
    const paymentMethodTrimmed =
      typeof payment_method === 'string' ? payment_method.trim() : ''
    const paidForTrimmed = typeof paid_for === 'string' ? paid_for.trim() : ''
    if (!paid_to || !amount || !submit_by || !paymentMethodTrimmed) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }
    
    const submitOnIso =
      typeof submit_on === 'string' && submit_on.trim() !== '' ? submit_on.trim() : undefined

    const amountNum = parseFloat(amount)
    if (!Number.isFinite(amountNum)) {
      return NextResponse.json({ error: '금액이 올바르지 않습니다.' }, { status: 400 })
    }
    const reimbNum =
      reimbursedAmountBody === undefined || reimbursedAmountBody === null || reimbursedAmountBody === ''
        ? 0
        : parseFloat(String(reimbursedAmountBody))
    if (!Number.isFinite(reimbNum) || reimbNum < 0) {
      return NextResponse.json({ error: '환급액이 올바르지 않습니다.' }, { status: 400 })
    }
    if (amountNum > 0 && reimbNum > amountNum + 0.001) {
      return NextResponse.json({ error: '환급액은 지출 금액을 초과할 수 없습니다.' }, { status: 400 })
    }
    const reimbursedOnNorm =
      typeof reimbursedOnBody === 'string' && reimbursedOnBody.trim() !== ''
        ? reimbursedOnBody.trim().slice(0, 10)
        : null
    const reimbursementNoteNorm =
      typeof reimbursementNoteBody === 'string' && reimbursementNoteBody.trim() !== ''
        ? reimbursementNoteBody.trim()
        : null

    const requestOperatorId = resolveOperatorId(
      typeof body.operatorId === 'string' ? body.operatorId : null
    )
    const operator_id = vehicle_id
      ? await lookupVehicleOperatorId(supabase, String(vehicle_id), requestOperatorId)
      : requestOperatorId

    const expenseData: CompanyExpenseInsert = {
      // ID는 자동 생성되므로 제공되지 않은 경우 undefined로 설정
      ...(id && { id }),
      paid_to,
      paid_for: paidForTrimmed,
      description: description || null,
      amount: amountNum,
      payment_method: paymentMethodTrimmed,
      submit_by,
      ...(submitOnIso !== undefined && { submit_on: submitOnIso }),
      photo_url: photo_url || null,
      category: category || null,
      subcategory: subcategory || null,
      vehicle_id: vehicle_id || null,
      maintenance_type: maintenance_type || null,
      notes: notes || null,
      attachments: attachments || null,
      expense_type: expense_type || null,
      tax_deductible: tax_deductible !== undefined ? tax_deductible : true,
      status: 'pending',
      operator_id,
      ...(paid_for_label_id !== undefined &&
        paid_for_label_id !== null &&
        paid_for_label_id !== '' && { paid_for_label_id: String(paid_for_label_id) }),
      ...(standardPaidForBody !== undefined && {
        standard_paid_for:
          standardPaidForBody === null || standardPaidForBody === ''
            ? null
            : String(standardPaidForBody).trim(),
      }),
      reimbursed_amount: amountNum > 0 ? reimbNum : 0,
      reimbursed_on: amountNum > 0 ? reimbursedOnNorm : null,
      reimbursement_note: amountNum > 0 ? reimbursementNoteNorm : null,
    }
    
    const { data, error } = await supabase
      .from('company_expenses')
      .insert(expenseData)
      .select()
      .single()
    
    if (error) {
      console.error('회사 지출 생성 오류:', error)
      return NextResponse.json({ error: '회사 지출을 생성할 수 없습니다.' }, { status: 500 })
    }

    await applyCompanyExpenseVehicleMileage(supabase, {
      expenseId: data.id,
      vehicleId: vehicle_id,
      mileage,
    })
    
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('회사 지출 생성 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const body = await request.json()
    
    const { id, ...rest } = body
    
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { ...rest }
    delete updateData.reimbursement_outstanding
    
    // 금액이 있으면 숫자로 변환
    if (updateData.amount !== undefined && updateData.amount !== null && updateData.amount !== '') {
      updateData.amount = parseFloat(String(updateData.amount))
    }

    const amt =
      updateData.amount !== undefined && updateData.amount !== null && updateData.amount !== ''
        ? Number(updateData.amount)
        : NaN
    if (
      updateData.reimbursed_amount !== undefined &&
      updateData.reimbursed_amount !== null &&
      updateData.reimbursed_amount !== ''
    ) {
      const r =
        typeof updateData.reimbursed_amount === 'number'
          ? updateData.reimbursed_amount
          : parseFloat(String(updateData.reimbursed_amount))
      if (!Number.isFinite(r) || r < 0) {
        return NextResponse.json({ error: '환급액이 올바르지 않습니다.' }, { status: 400 })
      }
      if (Number.isFinite(amt) && amt > 0 && r > amt + 0.001) {
        return NextResponse.json({ error: '환급액은 지출 금액을 초과할 수 없습니다.' }, { status: 400 })
      }
      updateData.reimbursed_amount = r
    }
    
    const { data, error } = await supabase
      .from('company_expenses')
      .update(updateData as never)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('회사 지출 수정 오류:', error)
      return NextResponse.json({ error: '회사 지출을 수정할 수 없습니다.' }, { status: 500 })
    }
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error('회사 지출 수정 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }
    
    const {
      data: { user }
    } = await supabase.auth.getUser()
    try {
      await softDeleteExpenseRecord(supabase, 'company_expenses', id, user?.email ?? null)
    } catch (error) {
      console.error('회사 지출 삭제 오류:', error)
      return NextResponse.json({ error: '회사 지출을 삭제할 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ message: '회사 지출이 삭제 보관함으로 옮겨졌습니다.' })
  } catch (error) {
    console.error('회사 지출 삭제 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
