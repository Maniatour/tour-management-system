import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { requireStaffApiAuth } from '@/lib/api-security'
import { isAdminSmsDbTemplateKey } from '@/lib/adminSmsTemplateCatalog'
import type { AdminSmsDbTemplateKey } from '@/lib/adminSmsTemplateCatalog'
import { getBuiltinGuideScheduleAssignmentSmsTemplate } from '@/lib/guideScheduleAssignmentSmsTemplate'
import { getBuiltinGuideScheduleConfirmSmsTemplate } from '@/lib/guideScheduleConfirmSmsTemplate'
import { getBuiltinPickupNotificationSmsTemplate, parsePickupNotificationSmsLocale } from '@/lib/pickupNotificationSms'
import type { SupportedLocale } from '@/lib/guideLanguageDetection'
import { fetchAdminSmsTemplateFromDb } from '@/lib/adminSmsTemplateDb'

function parseDbTemplateKey(v: string | null): AdminSmsDbTemplateKey | null {
  if (
    v === 'pickup_notification' ||
    v === 'guide_schedule_confirm' ||
    v === 'guide_schedule_assignment'
  ) {
    return v
  }
  return null
}

function getBuiltin(templateKey: AdminSmsDbTemplateKey, locale: string): string {
  if (templateKey === 'pickup_notification') {
    const loc = parsePickupNotificationSmsLocale(locale)
    if (!loc) return ''
    return getBuiltinPickupNotificationSmsTemplate(loc)
  }
  if (templateKey === 'guide_schedule_confirm') {
    const supported = ['ko', 'en', 'ja', 'zh'] as const
    if (!(supported as readonly string[]).includes(locale)) return ''
    return getBuiltinGuideScheduleConfirmSmsTemplate(locale as SupportedLocale)
  }
  if (templateKey === 'guide_schedule_assignment') {
    const supported = ['ko', 'en', 'ja', 'zh'] as const
    if (!(supported as readonly string[]).includes(locale)) return ''
    return getBuiltinGuideScheduleAssignmentSmsTemplate(locale as SupportedLocale)
  }
  return ''
}

/** GET: DB 저장 템플릿 또는 내장 기본값 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  const templateKey = parseDbTemplateKey(request.nextUrl.searchParams.get('template_key'))
  const locale = request.nextUrl.searchParams.get('locale')?.trim() || ''

  if (!templateKey || !locale) {
    return NextResponse.json({ error: 'template_key and locale required' }, { status: 400 })
  }

  const row = await fetchAdminSmsTemplateFromDb(templateKey, locale)
  const body_template = row ?? getBuiltin(templateKey, locale)
  return NextResponse.json({
    body_template,
    saved_in_db: !!row,
    template_key: templateKey,
    locale,
  })
}

/** PUT: locale별 SMS 템플릿 저장 */
export async function PUT(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const templateKey = parseDbTemplateKey(
      typeof body.template_key === 'string' ? body.template_key : null
    )
    const locale = typeof body.locale === 'string' ? body.locale.trim() : ''
    const body_template = typeof body.body_template === 'string' ? body.body_template : ''
    const updated_by = typeof body.updated_by === 'string' ? body.updated_by : null

    if (!templateKey || !locale) {
      return NextResponse.json({ error: 'template_key and locale required' }, { status: 400 })
    }
    if (!isAdminSmsDbTemplateKey(templateKey)) {
      return NextResponse.json({ error: 'invalid template_key' }, { status: 400 })
    }
    if (!body_template.trim()) {
      return NextResponse.json({ error: 'body_template is required' }, { status: 400 })
    }

    const db = supabaseAdmin ?? supabase
    const { error } = await fromUntypedTable(db, 'admin_sms_templates').upsert(
      {
        template_key: templateKey,
        locale,
        body_template: body_template.trim(),
        updated_at: new Date().toISOString(),
        updated_by,
      } as never,
      { onConflict: 'template_key,locale' }
    )

    if (error) {
      console.error('admin-sms-templates PUT:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('admin-sms-templates PUT:', e)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
}

/** DELETE: DB 템플릿 삭제 → 이후 GET은 기본값 */
export async function DELETE(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  const templateKey = parseDbTemplateKey(request.nextUrl.searchParams.get('template_key'))
  const locale = request.nextUrl.searchParams.get('locale')?.trim() || ''

  if (!templateKey || !locale) {
    return NextResponse.json({ error: 'template_key and locale required' }, { status: 400 })
  }

  const db = supabaseAdmin ?? supabase
  const { error } = await fromUntypedTable(db, 'admin_sms_templates')
    .delete()
    .eq('template_key', templateKey)
    .eq('locale', locale)

  if (error) {
    console.error('admin-sms-templates DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
