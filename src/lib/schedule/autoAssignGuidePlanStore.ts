import { supabase } from '@/lib/supabase'
import {
  AUTO_ASSIGN_GUIDE_PLAN_SETTING_KEY,
  parseStoredGuidePlan,
} from '@/lib/schedule/autoAssignGuidePlan'
import type { AutoAssignGuidePlanEntry } from '@/lib/schedule/autoAssignSchedule'

export async function fetchSharedGuidePlan(): Promise<
  { ok: true; entries: AutoAssignGuidePlanEntry[] } | { ok: false; error: string }
> {
  const { data, error } = await supabase
    .from('shared_settings')
    .select('setting_value')
    .eq('setting_key', AUTO_ASSIGN_GUIDE_PLAN_SETTING_KEY)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, entries: parseStoredGuidePlan(data?.setting_value) }
}

export async function saveSharedGuidePlan(
  entries: AutoAssignGuidePlanEntry[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.from('shared_settings').upsert(
    {
      setting_key: AUTO_ASSIGN_GUIDE_PLAN_SETTING_KEY,
      setting_value: { entries },
      ...(userData.user?.id ? { updated_by: userData.user.id } : {}),
    },
    { onConflict: 'setting_key' },
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
