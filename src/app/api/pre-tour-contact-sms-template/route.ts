import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { getBuiltinPreTourContactSmsTemplate } from '@/lib/preTourContactSms'
import { fetchPreTourContactSmsTemplateFromDb } from '@/lib/preTourContactSmsTemplateDb'
import type { PreTourContactSmsLocale } from '@/lib/preTourContactSmsLocale'

function parseLocale(v: string | null): PreTourContactSmsLocale | null {
  if (v === 'ko' || v === 'en' || v === 'ja') return v
  return null
}

/** GET: DB 저장 템플릿 또는 내장 기본값 */
export async function GET(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get('locale'))
  if (!locale) {
    return NextResponse.json({ error: 'locale=ko|en|ja required' }, { status: 400 })
  }

  const row = await fetchPreTourContactSmsTemplateFromDb(locale)
  const body_template = row ?? getBuiltinPreTourContactSmsTemplate(locale)
  return NextResponse.json({
    body_template,
    saved_in_db: !!row,
    locale,
  })
}

/** PUT: locale별 SMS 템플릿 저장 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const locale = parseLocale(typeof body.locale === 'string' ? body.locale : null)
    const body_template = typeof body.body_template === 'string' ? body.body_template : ''
    const updated_by = typeof body.updated_by === 'string' ? body.updated_by : null

    if (!locale) {
      return NextResponse.json({ error: 'locale required' }, { status: 400 })
    }
    if (!body_template.trim()) {
      return NextResponse.json({ error: 'body_template is required' }, { status: 400 })
    }

    const db = supabaseAdmin ?? supabase
    const { error } = await (db as any).from('pre_tour_contact_sms_templates').upsert(
      {
        locale,
        body_template: body_template.trim(),
        updated_at: new Date().toISOString(),
        updated_by,
      },
      { onConflict: 'locale' }
    )

    if (error) {
      console.error('pre-tour-contact-sms-template PUT:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('pre-tour-contact-sms-template PUT:', e)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
}

/** DELETE: DB 템플릿 삭제 → 이후 GET은 기본값 */
export async function DELETE(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get('locale'))
  if (!locale) {
    return NextResponse.json({ error: 'locale=ko|en|ja required' }, { status: 400 })
  }

  const db = supabaseAdmin ?? supabase
  const { error } = await (db as any)
    .from('pre_tour_contact_sms_templates')
    .delete()
    .eq('locale', locale)

  if (error) {
    console.error('pre-tour-contact-sms-template DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
