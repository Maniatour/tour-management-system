import { NextRequest, NextResponse } from 'next/server'
import {
  fetchMessengerContactSettingsFromDb,
  upsertMessengerContactSettings,
} from '@/lib/messengerContactSettingsDb'
import { DEFAULT_MESSENGER_CONTACT_SETTINGS } from '@/lib/preTourContactSms'

/** GET: 메신저 연락처 설정 */
export async function GET() {
  const settings = await fetchMessengerContactSettingsFromDb()
  return NextResponse.json({ ...settings, defaults: DEFAULT_MESSENGER_CONTACT_SETTINGS })
}

/** PUT: 메신저 연락처 설정 저장 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const line_id = typeof body.line_id === 'string' ? body.line_id.trim() : ''
    const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : ''
    const kakao = typeof body.kakao === 'string' ? body.kakao.trim() : ''
    const contact_email = typeof body.contact_email === 'string' ? body.contact_email.trim() : ''
    const updated_by = typeof body.updated_by === 'string' ? body.updated_by : null

    if (!line_id || !whatsapp || !kakao || !contact_email) {
      return NextResponse.json({ error: '모든 연락처 필드가 필요합니다.' }, { status: 400 })
    }

    const result = await upsertMessengerContactSettings(
      { line_id, whatsapp, kakao, contact_email },
      updated_by
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('messenger-contact-settings PUT:', e)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
}
