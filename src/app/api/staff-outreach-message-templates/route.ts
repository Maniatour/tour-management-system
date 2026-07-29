import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { listStaffOutreachMessageTemplatesFromDb } from '@/lib/staffOutreachMessageTemplateDb'
import type {
  StaffOutreachMessageChannel,
  StaffOutreachMessageLocale,
  StaffOutreachTemplateScope,
} from '@/lib/staffOutreachMessageTemplates'

const SCOPES: StaffOutreachTemplateScope[] = [
  'cancellation_follow_up',
  'pending_alt_tour',
  'resident_inquiry',
]

function parseLocale(v: string | null): StaffOutreachMessageLocale | null {
  if (v === 'ko' || v === 'en') return v
  return null
}

function parseChannel(v: string | null): StaffOutreachMessageChannel | null {
  if (v === 'email' || v === 'sms') return v
  return null
}

function parseScope(v: string | null): StaffOutreachTemplateScope | null {
  if (v && SCOPES.includes(v as StaffOutreachTemplateScope)) {
    return v as StaffOutreachTemplateScope
  }
  return null
}

/**
 * GET: scope+locale+channel+variant 그룹의 템플릿 목록
 * POST: 새 템플릿 생성
 * PUT: id로 템플릿 수정
 * DELETE: id로 템플릿 삭제
 */
export async function GET(request: NextRequest) {
  const scope = parseScope(request.nextUrl.searchParams.get('scope'))
  const locale = parseLocale(request.nextUrl.searchParams.get('locale'))
  const channel = parseChannel(request.nextUrl.searchParams.get('channel'))
  const variant = request.nextUrl.searchParams.get('variant')?.trim() || 'default'

  if (!scope || !locale || !channel) {
    return NextResponse.json(
      { error: 'scope, locale=ko|en, channel=email|sms required' },
      { status: 400 }
    )
  }

  const templates = await listStaffOutreachMessageTemplatesFromDb(scope, locale, channel, variant)
  return NextResponse.json({ templates, scope, locale, channel, variant })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const scope = parseScope(typeof body.scope === 'string' ? body.scope : null)
    const locale = parseLocale(typeof body.locale === 'string' ? body.locale : null)
    const channel = parseChannel(typeof body.channel === 'string' ? body.channel : null)
    const variant =
      typeof body.variant === 'string' && body.variant.trim()
        ? body.variant.trim()
        : 'default'
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const subject_template =
      typeof body.subject_template === 'string' ? body.subject_template : null
    const body_template = typeof body.body_template === 'string' ? body.body_template : ''
    const sort_order = typeof body.sort_order === 'number' ? body.sort_order : 0
    const updated_by = typeof body.updated_by === 'string' ? body.updated_by : null

    if (!scope || !locale || !channel) {
      return NextResponse.json({ error: 'scope, locale, channel required' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!body_template.trim()) {
      return NextResponse.json({ error: 'body_template is required' }, { status: 400 })
    }
    if (channel === 'email' && !subject_template?.trim()) {
      return NextResponse.json({ error: 'subject_template is required for email' }, { status: 400 })
    }

    const db = supabaseAdmin ?? supabase
    const { data, error } = await fromUntypedTable(db, 'staff_outreach_message_templates')
      .insert({
        scope,
        locale,
        channel,
        variant,
        name,
        subject_template: channel === 'email' ? subject_template?.trim() ?? '' : null,
        body_template: body_template.trim(),
        sort_order,
        updated_at: new Date().toISOString(),
        updated_by,
      } as never)
      .select('id,scope,locale,channel,variant,name,subject_template,body_template,sort_order,updated_at,updated_by')
      .single()

    if (error) {
      console.error('staff-outreach-message-templates POST:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (e) {
    console.error('staff-outreach-message-templates POST:', e)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const subject_template =
      body.subject_template === null || typeof body.subject_template === 'string'
        ? body.subject_template
        : undefined
    const body_template = typeof body.body_template === 'string' ? body.body_template : undefined
    const sort_order = typeof body.sort_order === 'number' ? body.sort_order : undefined
    const updated_by = typeof body.updated_by === 'string' ? body.updated_by : null

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (name !== undefined) {
      if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
      patch.name = name
    }
    if (subject_template !== undefined) patch.subject_template = subject_template
    if (body_template !== undefined) {
      if (!body_template.trim()) {
        return NextResponse.json({ error: 'body_template cannot be empty' }, { status: 400 })
      }
      patch.body_template = body_template.trim()
    }
    if (sort_order !== undefined) patch.sort_order = sort_order
    if (updated_by != null) patch.updated_by = updated_by

    const db = supabaseAdmin ?? supabase
    const { data, error } = await fromUntypedTable(db, 'staff_outreach_message_templates')
      .update(patch as never)
      .eq('id', id)
      .select('id,scope,locale,channel,variant,name,subject_template,body_template,sort_order,updated_at,updated_by')
      .single()

    if (error) {
      console.error('staff-outreach-message-templates PUT:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (e) {
    console.error('staff-outreach-message-templates PUT:', e)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')?.trim()
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const db = supabaseAdmin ?? supabase
  const { error } = await fromUntypedTable(db, 'staff_outreach_message_templates')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('staff-outreach-message-templates DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
