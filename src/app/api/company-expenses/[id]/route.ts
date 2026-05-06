import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { Database } from '@/lib/database.types'

type CompanyExpenseUpdate = Database['public']['Tables']['company_expenses']['Update']

type RouteParams = Promise<{ id: string }> | { id: string }

async function resolveId(params: RouteParams): Promise<string | undefined> {
  const resolved = await Promise.resolve(params)
  return resolved?.id
}

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('company_expenses')
      .select(`
        *,
        vehicles (
          id,
          vehicle_number,
          vehicle_type,
          vehicle_category
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('회사 지출 조회 오류:', error)
      return NextResponse.json({ error: '회사 지출을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('회사 지출 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const body = await request.json()

    const {
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
      status: statusBody,
      paid_for_label_id: paidForLabelIdBody,
      standard_paid_for: standardPaidForBody,
      reimbursed_amount: reimbursedAmountBody,
      reimbursed_on: reimbursedOnBody,
      reimbursement_note: reimbursementNoteBody,
    } = body

    const paymentMethodTrimmed =
      typeof payment_method === 'string' ? payment_method.trim() : ''
    const paidForTrimmed = typeof paid_for === 'string' ? paid_for.trim() : ''
    if (
      !paid_to ||
      amount === undefined ||
      amount === null ||
      amount === '' ||
      !submit_by ||
      !paymentMethodTrimmed
    ) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    const parsedAmount =
      typeof amount === 'number' && !Number.isNaN(amount) ? amount : parseFloat(String(amount))
    if (Number.isNaN(parsedAmount)) {
      return NextResponse.json({ error: '금액이 올바르지 않습니다.' }, { status: 400 })
    }

    const submitOnIso =
      typeof submit_on === 'string' && submit_on.trim() !== '' ? submit_on.trim() : undefined

    const reimbNum =
      reimbursedAmountBody === undefined || reimbursedAmountBody === null || reimbursedAmountBody === ''
        ? 0
        : typeof reimbursedAmountBody === 'number'
          ? reimbursedAmountBody
          : parseFloat(String(reimbursedAmountBody))
    if (!Number.isFinite(reimbNum) || reimbNum < 0) {
      return NextResponse.json({ error: '환급액이 올바르지 않습니다.' }, { status: 400 })
    }
    if (parsedAmount > 0 && reimbNum > parsedAmount + 0.001) {
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

    const updatePayload: CompanyExpenseUpdate = {
      paid_to,
      paid_for: paidForTrimmed,
      description: description || null,
      amount: parsedAmount,
      payment_method: paymentMethodTrimmed,
      submit_by,
      ...(submitOnIso !== undefined && { submit_on: submitOnIso }),
      photo_url: photo_url || null,
      category: category || null,
      subcategory: subcategory || null,
      vehicle_id: vehicle_id || null,
      maintenance_type: maintenance_type || null,
      notes: notes || null,
      attachments: attachments ?? null,
      expense_type: expense_type || null,
      tax_deductible: tax_deductible !== undefined ? tax_deductible : true,
      ...(statusBody !== undefined &&
        statusBody !== null &&
        String(statusBody).trim() !== '' && { status: String(statusBody).trim() }),
      ...(paidForLabelIdBody !== undefined && {
        paid_for_label_id:
          paidForLabelIdBody === null || paidForLabelIdBody === '' ? null : String(paidForLabelIdBody),
      }),
      ...(standardPaidForBody !== undefined && {
        standard_paid_for:
          standardPaidForBody === null || standardPaidForBody === ''
            ? null
            : String(standardPaidForBody),
      }),
      reimbursed_amount: parsedAmount > 0 ? reimbNum : 0,
      reimbursed_on: parsedAmount > 0 ? reimbursedOnNorm : null,
      reimbursement_note: parsedAmount > 0 ? reimbursementNoteNorm : null,
    }

    const { data, error } = await supabase
      .from('company_expenses')
      .update(updatePayload)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const supabase = await getSupabaseForApiRoute(request)
    if (supabase instanceof NextResponse) return supabase
    const id = await resolveId(params)
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const { error } = await supabase.from('company_expenses').delete().eq('id', id)

    if (error) {
      console.error('회사 지출 삭제 오류:', error)
      return NextResponse.json({ error: '회사 지출을 삭제할 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ message: '회사 지출이 삭제되었습니다.' })
  } catch (error) {
    console.error('회사 지출 삭제 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
