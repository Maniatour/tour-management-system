import { supabase, supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  mergeAdminSmsCategorySettings,
  type AdminSmsCategorySettingsRow,
} from '@/lib/adminSmsCategorySettings'
import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'

export async function listAdminSmsCategorySettingsFromDb(): Promise<
  Record<AdminSmsCategoryId, AdminSmsCategorySettingsRow>
> {
  const db = supabaseAdmin ?? supabase
  const { data, error } = await fromUntypedTable(db, 'admin_sms_category_settings')
    .select('category_key, label_ko, label_en, icon_key, sort_order, updated_at, updated_by')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('listAdminSmsCategorySettingsFromDb:', error)
    return mergeAdminSmsCategorySettings([])
  }

  return mergeAdminSmsCategorySettings((data ?? []) as AdminSmsCategorySettingsRow[])
}

export async function upsertAdminSmsCategorySettings(
  row: Pick<
    AdminSmsCategorySettingsRow,
    'category_key' | 'label_ko' | 'label_en' | 'icon_key' | 'sort_order'
  > & { updated_by?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin ?? supabase
  const { error } = await fromUntypedTable(db, 'admin_sms_category_settings').upsert(
    {
      category_key: row.category_key,
      label_ko: row.label_ko.trim(),
      label_en: row.label_en.trim(),
      icon_key: row.icon_key.trim(),
      sort_order: row.sort_order,
      updated_at: new Date().toISOString(),
      updated_by: row.updated_by ?? null,
    } as never,
    { onConflict: 'category_key' }
  )

  if (error) {
    console.error('upsertAdminSmsCategorySettings:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
