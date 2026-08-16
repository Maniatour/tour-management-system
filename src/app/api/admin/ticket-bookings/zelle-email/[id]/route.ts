import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { htmlEmailToPlainTextKeepLines, parseZellePaymentEmail } from '@/lib/zellePaymentEmail'

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
  const { data, error } = await client
    .from('reservation_imports')
    .select('id, subject, received_at, raw_body_text, raw_body_html, extracted_data, platform_key')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '메일을 찾을 수 없습니다.' }, { status: 404 })

  const htmlRaw = String(data.raw_body_html ?? '').trim()
  const textRaw = String(data.raw_body_text ?? '').trim()
  const parsed = parseZellePaymentEmail(textRaw || null, htmlRaw || null)
  const looksHtml = /<\/?[a-z][\s\S]{0,80}>/i.test(htmlRaw || textRaw)
  const html = htmlRaw || (looksHtml ? textRaw : '')
  const text = html
    ? htmlEmailToPlainTextKeepLines(html)
    : textRaw || htmlEmailToPlainTextKeepLines(String((data.extracted_data as { zelle?: { memo?: string } } | null)?.zelle?.memo ?? ''))

  return NextResponse.json({
    id: data.id,
    subject: data.subject,
    receivedAt: data.received_at,
    html: html || null,
    text: text || null,
    parsed: {
      amount: parsed.amount,
      recipient: parsed.recipient,
      paymentDateYmd: parsed.paymentDateYmd,
      confirmationNumber: parsed.confirmationNumber,
      memo: parsed.memo,
      rnNumbers: parsed.rnNumbers,
      invoiceNumbers: parsed.invoiceNumbers,
    },
  })
}
