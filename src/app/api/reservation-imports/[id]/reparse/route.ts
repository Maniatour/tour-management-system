import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { extractReservationFromEmail } from '@/lib/emailReservationParser'

/**
 * POST /api/reservation-imports/[id]/reparse
 * 저장된 raw_body_text/html + subject로 다시 파싱해 extracted_data 갱신 (기존 데이터가 비었을 때 사용)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase

  const { data: row, error: fetchError } = await client
    .from('reservation_imports')
    .select('id, subject, raw_body_text, raw_body_html, source_email, extracted_data, status')
    .eq('id', id)
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (row.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending imports can be reparsed' }, { status: 400 })
  }

  const subject = row.subject ?? ''
  const text = row.raw_body_text ?? null
  const html = row.raw_body_html ?? null
  const from = row.source_email ?? null

  const { platform_key, extracted_data } = extractReservationFromEmail({
    subject,
    text,
    html,
    sourceEmail: from,
  })

  const { error: updateError } = await client
    .from('reservation_imports')
    .update({
      platform_key: platform_key ?? row.platform_key,
      extracted_data: extracted_data as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { data: updated } = await client
    .from('reservation_imports')
    .select('*')
    .eq('id', id)
    .single()

  return NextResponse.json(updated ?? row)
}
