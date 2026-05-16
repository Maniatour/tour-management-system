import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { extractReservationFromEmail } from '@/lib/emailReservationParser'

/**
 * POST /api/reservation-imports/[id]/reparse
 * 저장된 raw_body_text/html + subject로 다시 파싱해 extracted_data·platform_key 갱신.
 * 상태(pending/confirmed 등)와 무관 — 본문만 있으면 실행(이미 예약이 연결돼 있어도 가져오기 행만 갱신).
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

  const subject = row.subject ?? ''
  const text = row.raw_body_text ?? null
  const html = row.raw_body_html ?? null
  const hasBody = Boolean((text && text.trim()) || (html && html.trim()))
  if (!hasBody) {
    return NextResponse.json({ error: 'No raw email body stored for this import' }, { status: 400 })
  }
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
