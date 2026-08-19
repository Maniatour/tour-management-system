import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { ensureAtmReceiptBody } from '@/lib/ensureAtmReceiptBody'

export const maxDuration = 30

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseForApiRoute(request)
  if (auth instanceof NextResponse) return auth
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

  const client = supabaseAdmin ?? auth
  const result = await ensureAtmReceiptBody(client, id)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result)
}
