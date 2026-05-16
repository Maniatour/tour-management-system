import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  getBuiltinCancellationFollowUpTemplate,
  type CancellationFollowUpMessageChannel,
  type CancellationFollowUpMessageKind,
  type CancellationFollowUpMessageLocale,
} from '@/lib/cancellationFollowUpMessage'
import { fetchCancellationFollowUpMessageTemplateFromDb } from '@/lib/cancellationFollowUpMessageTemplateDb'

function parseLocale(v: string | null): CancellationFollowUpMessageLocale | null {
  if (v === 'ko' || v === 'en') return v
  return null
}

function parseChannel(v: string | null): CancellationFollowUpMessageChannel | null {
  if (v === 'email' || v === 'sms') return v
  return null
}

function parseMessageKind(v: string | null): CancellationFollowUpMessageKind | null {
  if (v === 'follow_up' || v === 'rebooking') return v
  return null
}

/**
 * GET: DB 저장 템플릿 또는 내장 기본값
 * PUT: locale + channel + message_kind별 템플릿 저장
 * DELETE: 해당 키 DB 행 삭제 → 이후 GET은 기본값
 */
export async function GET(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get('locale'))
  const channel = parseChannel(request.nextUrl.searchParams.get('channel'))
  const messageKind = parseMessageKind(request.nextUrl.searchParams.get('message_kind'))
  if (!locale || !channel || !messageKind) {
    return NextResponse.json(
      { error: 'locale=ko|en&channel=email|sms&message_kind=follow_up|rebooking required' },
      { status: 400 }
    )
  }

  const row = await fetchCancellationFollowUpMessageTemplateFromDb(locale, channel, messageKind)
  const builtin = getBuiltinCancellationFollowUpTemplate(locale, channel, messageKind)
  const subject_template = row?.subject_template ?? builtin.subject
  const body_template = row?.body_template ?? builtin.body
  return NextResponse.json({
    subject_template,
    body_template,
    saved_in_db: !!row,
    locale,
    channel,
    message_kind: messageKind,
  })
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const locale = parseLocale(typeof body.locale === 'string' ? body.locale : null)
    const channel = parseChannel(typeof body.channel === 'string' ? body.channel : null)
    const messageKind = parseMessageKind(typeof body.message_kind === 'string' ? body.message_kind : null)
    const subject_template =
      typeof body.subject_template === 'string' ? body.subject_template : null
    const body_template = typeof body.body_template === 'string' ? body.body_template : ''
    const updated_by = typeof body.updated_by === 'string' ? body.updated_by : null

    if (!locale || !channel || !messageKind) {
      return NextResponse.json({ error: 'locale, channel, message_kind required' }, { status: 400 })
    }
    if (!body_template.trim()) {
      return NextResponse.json({ error: 'body_template is required' }, { status: 400 })
    }
    if (channel === 'email' && !subject_template?.trim()) {
      return NextResponse.json({ error: 'subject_template is required for email' }, { status: 400 })
    }

    const db = supabaseAdmin ?? supabase
    const { error } = await db.from('cancellation_follow_up_message_templates').upsert(
      {
        locale,
        channel,
        message_kind: messageKind,
        subject_template: channel === 'email' ? subject_template?.trim() ?? '' : null,
        body_template: body_template.trim(),
        updated_at: new Date().toISOString(),
        updated_by,
      },
      { onConflict: 'locale,channel,message_kind' }
    )

    if (error) {
      console.error('cancellation-follow-up-message-template PUT:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('cancellation-follow-up-message-template PUT:', e)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get('locale'))
  const channel = parseChannel(request.nextUrl.searchParams.get('channel'))
  const messageKind = parseMessageKind(request.nextUrl.searchParams.get('message_kind'))
  if (!locale || !channel || !messageKind) {
    return NextResponse.json(
      { error: 'locale=ko|en&channel=email|sms&message_kind=follow_up|rebooking required' },
      { status: 400 }
    )
  }

  const db = supabaseAdmin ?? supabase
  const { error } = await db
    .from('cancellation_follow_up_message_templates')
    .delete()
    .eq('locale', locale)
    .eq('channel', channel)
    .eq('message_kind', messageKind)

  if (error) {
    console.error('cancellation-follow-up-message-template DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
