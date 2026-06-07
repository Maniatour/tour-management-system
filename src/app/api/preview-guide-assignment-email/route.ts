import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  buildGuideAssignmentEmailContent,
  type GuideAssignmentChangeItem,
  type GuideAssignmentEmailKind,
} from '@/lib/guideAssignmentSchedule'

/**
 * POST /api/preview-guide-assignment-email
 * 가이드 배정 안내 이메일 미리보기
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recipientEmail, items, locale, kind } = body as {
      recipientEmail?: string
      items?: GuideAssignmentChangeItem[]
      locale?: 'ko' | 'en'
      kind?: GuideAssignmentEmailKind
    }

    if (!recipientEmail || !items?.length || !kind) {
      return NextResponse.json(
        { error: '수신자 이메일, 안내 유형, 배정 변경 목록이 필요합니다.' },
        { status: 400 },
      )
    }

    const db = supabaseAdmin ?? supabase
    const { data: member } = await db
      .from('team')
      .select('email, name_ko, nick_name, display_name, languages')
      .eq('email', recipientEmail)
      .maybeSingle()

    const row = member as {
      name_ko?: string | null
      nick_name?: string | null
      display_name?: string | null
      languages?: string[] | null
    } | null

    const recipientName =
      row?.nick_name || row?.display_name || row?.name_ko || recipientEmail.split('@')[0]

    const langs = row?.languages ?? []
    const inferredLocale =
      locale ?? (langs.some((l) => String(l).toLowerCase().startsWith('en')) ? 'en' : 'ko')

    const emailContent = buildGuideAssignmentEmailContent({
      recipientName,
      recipientEmail,
      kind,
      items,
      locale: inferredLocale,
    })

    return NextResponse.json({
      success: true,
      recipientName,
      recipientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    })
  } catch (error) {
    console.error('[preview-guide-assignment-email]', error)
    return NextResponse.json(
      { error: '이메일 미리보기 생성 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
