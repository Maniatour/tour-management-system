import { NextRequest, NextResponse } from 'next/server'
import { getPublicOperatorId } from '@/lib/operators/getPublicOperatorId'
import {
  parseCustomerReviewFormData,
  submitCustomerProductReview,
} from '@/lib/customerReviewSubmit'

function clientIpFromRequest(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || null
}

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid form data' }, { status: 400 })
  }

  const operatorId = await getPublicOperatorId()
  const input = parseCustomerReviewFormData(formData, clientIpFromRequest(request))
  const result = await submitCustomerProductReview(operatorId, input)

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status })
  }

  return NextResponse.json({ ok: true, pending: result.pending })
}
