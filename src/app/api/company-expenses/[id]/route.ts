import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = createClient()
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
    const supabase = createClient()
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
    } = body

    const paymentMethodTrimmed =
      typeof payment_method === 'string' ? payment_method.trim() : ''
    if (
      !paid_to ||
      !paid_for ||
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

    const updatePayload: CompanyExpenseUpdate = {
      paid_to,
      paid_for,
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
    const supabase = createClient()
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
