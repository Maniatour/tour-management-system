import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { buildAdminSmsSamplePreview } from '@/lib/adminSmsSamplePreview'
import { ADMIN_SMS_CATEGORIES, type AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'
import { sendTwilioSms } from '@/lib/twilioClient'
import { formatPhoneToE164 } from '@/utils/formatPhoneToE164'

const VALID_CATEGORY_IDS = new Set(ADMIN_SMS_CATEGORIES.map((c) => c.id))

function parseCategoryId(v: unknown): AdminSmsCategoryId | null {
  if (typeof v !== 'string' || !VALID_CATEGORY_IDS.has(v as AdminSmsCategoryId)) return null
  if (v === 'messenger_contacts') return null
  return v as AdminSmsCategoryId
}

/**
 * POST /api/admin-sms-sample-send
 * SMS 관리 — 샘플 데이터로 치환한 템플릿을 지정 번호로 발송
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const categoryId = parseCategoryId(body.categoryId)
    const locale = typeof body.locale === 'string' && body.locale.trim() ? body.locale.trim() : 'ko'
    const bodyTemplate = typeof body.bodyTemplate === 'string' ? body.bodyTemplate : ''
    const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : ''

    if (!categoryId) {
      return NextResponse.json({ error: '유효하지 않은 SMS 카테고리입니다.' }, { status: 400 })
    }
    if (!bodyTemplate.trim()) {
      return NextResponse.json({ error: '템플릿 본문이 비어 있습니다.' }, { status: 400 })
    }
    if (!phoneRaw) {
      return NextResponse.json({ error: '전화번호를 입력하세요.' }, { status: 400 })
    }

    const toPhone = formatPhoneToE164(phoneRaw, 'US')
    if (!toPhone) {
      return NextResponse.json(
        { error: '전화번호 형식이 올바르지 않습니다. (+1..., +82... 등)' },
        { status: 400 }
      )
    }

    const message = buildAdminSmsSamplePreview({
      categoryId,
      locale,
      bodyTpl: bodyTemplate,
    })
    if (!message.trim()) {
      return NextResponse.json({ error: '미리보기 메시지를 생성할 수 없습니다.' }, { status: 400 })
    }

    const twilioResult = await sendTwilioSms(toPhone, message)
    if ('error' in twilioResult) {
      return NextResponse.json(
        { error: 'SMS 발송에 실패했습니다.', details: twilioResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '샘플 SMS가 발송되었습니다.',
      toPhone,
      twilioMessageSid: twilioResult.sid,
      previewLength: message.length,
    })
  } catch (e) {
    console.error('[admin-sms-sample-send]', e)
    return NextResponse.json({ error: 'SMS 발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
