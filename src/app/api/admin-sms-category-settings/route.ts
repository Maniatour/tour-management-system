import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import {
  DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS,
} from '@/lib/adminSmsCategorySettings'
import {
  listAdminSmsCategorySettingsFromDb,
  upsertAdminSmsCategorySettings,
} from '@/lib/adminSmsCategorySettingsDb'
import { isValidAdminSmsCategoryIconKey } from '@/lib/adminSmsCategoryIcons'
import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'

const VALID_KEYS = new Set(Object.keys(DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS))

function parseCategoryKey(v: unknown): AdminSmsCategoryId | null {
  if (typeof v !== 'string' || !VALID_KEYS.has(v)) return null
  return v as AdminSmsCategoryId
}

/** GET: 전체 카테고리 설정 (기본값 병합) */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  const settings = await listAdminSmsCategorySettingsFromDb()
  return NextResponse.json({ settings: Object.values(settings) })
}

/** PUT: 카테고리 표시명·아이콘 저장 */
export async function PUT(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const category_key = parseCategoryKey(body.category_key)
    const label_ko = typeof body.label_ko === 'string' ? body.label_ko : ''
    const label_en = typeof body.label_en === 'string' ? body.label_en : ''
    const icon_key = typeof body.icon_key === 'string' ? body.icon_key.trim() : ''
    const sort_order =
      typeof body.sort_order === 'number'
        ? body.sort_order
        : DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS[category_key ?? 'pre_tour_contact']?.sort_order ?? 0
    const updated_by = typeof body.updated_by === 'string' ? body.updated_by : null

    if (!category_key) {
      return NextResponse.json({ error: 'category_key required' }, { status: 400 })
    }
    if (!label_ko.trim() || !label_en.trim()) {
      return NextResponse.json({ error: 'label_ko and label_en required' }, { status: 400 })
    }
    if (!icon_key || !isValidAdminSmsCategoryIconKey(icon_key)) {
      return NextResponse.json({ error: 'invalid icon_key' }, { status: 400 })
    }

    const result = await upsertAdminSmsCategorySettings({
      category_key,
      label_ko,
      label_en,
      icon_key,
      sort_order,
      updated_by,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    const settings = await listAdminSmsCategorySettingsFromDb()
    return NextResponse.json({ success: true, row: settings[category_key] })
  } catch (e) {
    console.error('admin-sms-category-settings PUT:', e)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
}
