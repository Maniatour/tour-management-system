import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { getBuiltinResidentInquiryEmailTemplate, type ResidentInquiryEmailLocale } from '@/lib/residentInquiryEmailHtml'
import { fetchResidentInquiryEmailTemplateFromDb } from '@/lib/residentInquiryEmailTemplateDb'
import {
  parseResidentInquiryEmailTourKindParam,
  type ResidentInquiryEmailTourKind,
} from '@/lib/residentInquiryTourKind'

function parseLocale(v: string | null): ResidentInquiryEmailLocale | null {
  if (v === 'ko' || v === 'en') return v
  return null
}

function parseTourKind(v: string | null): ResidentInquiryEmailTourKind {
  return parseResidentInquiryEmailTourKindParam(v) ?? 'day_tour'
}

/**
 * GET: DB 저장 템플릿 또는 내장 기본값 (tour_kind: day_tour | multi_day)
 * PUT: locale + tour_kind별 템플릿 저장
 * DELETE: 해당 locale+tour_kind DB 행 삭제 → 이후 GET은 기본값
 */
export async function GET(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get('locale'))
  if (!locale) {
    return NextResponse.json({ error: 'locale=ko|en required' }, { status: 400 })
  }

  const tourKind = parseTourKind(request.nextUrl.searchParams.get('tour_kind'))

  const row = await fetchResidentInquiryEmailTemplateFromDb(locale, tourKind)
  const builtin = getBuiltinResidentInquiryEmailTemplate(locale, tourKind)
  const subject_template = row?.subject_template ?? builtin.subject
  const html_template = row?.html_template ?? builtin.html
  return NextResponse.json({
    subject_template,
    html_template,
    saved_in_db: !!row,
    tour_kind: tourKind,
  })
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const locale = parseLocale(typeof body.locale === 'string' ? body.locale : null)
    const tourKind = parseTourKind(typeof body.tour_kind === 'string' ? body.tour_kind : null)
    const subject_template = typeof body.subject_template === 'string' ? body.subject_template : ''
    const html_template = typeof body.html_template === 'string' ? body.html_template : ''
    const updated_by = typeof body.updated_by === 'string' ? body.updated_by : null

    if (!locale) {
      return NextResponse.json({ error: 'locale must be ko or en' }, { status: 400 })
    }
    if (!subject_template.trim() || !html_template.trim()) {
      return NextResponse.json({ error: 'subject_template and html_template are required' }, { status: 400 })
    }

    const db = supabaseAdmin ?? supabase
    const { error } = await db.from('resident_inquiry_email_templates').upsert(
      {
        locale,
        tour_kind: tourKind,
        subject_template: subject_template.trim(),
        html_template: html_template.trim(),
        updated_at: new Date().toISOString(),
        updated_by,
      },
      { onConflict: 'locale,tour_kind' }
    )

    if (error) {
      console.error('resident-inquiry-email-template PUT:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('resident-inquiry-email-template PUT:', e)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get('locale'))
  if (!locale) {
    return NextResponse.json({ error: 'locale=ko|en required' }, { status: 400 })
  }

  const tourKind = parseTourKind(request.nextUrl.searchParams.get('tour_kind'))

  const db = supabaseAdmin ?? supabase
  const { error } = await db
    .from('resident_inquiry_email_templates')
    .delete()
    .eq('locale', locale)
    .eq('tour_kind', tourKind)

  if (error) {
    console.error('resident-inquiry-email-template DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
