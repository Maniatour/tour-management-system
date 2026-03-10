import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/reservation-imports/[id]/reject
 * status = rejected 처리
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase
  const { data, error } = await client
    .from('reservation_imports')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found or already processed' }, { status: 404 })
  }
  return NextResponse.json({ id: data.id, status: 'rejected' })
}
