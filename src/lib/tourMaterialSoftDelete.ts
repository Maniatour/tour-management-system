import type { SupabaseClient } from '@supabase/supabase-js'

export function isTourMaterialSoftDeleted(isActive: boolean | null | undefined): boolean {
  return isActive === false
}

export async function softDeleteTourMaterial(
  sb: SupabaseClient,
  id: string
): Promise<void> {
  const now = new Date().toISOString()
  const { data, error } = await sb
    .from('tour_materials')
    .update({
      is_active: false,
      updated_at: now,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('자료를 찾을 수 없거나 이미 삭제되었습니다.')
}

export async function restoreTourMaterial(
  sb: SupabaseClient,
  id: string
): Promise<void> {
  const now = new Date().toISOString()
  const { data, error } = await sb
    .from('tour_materials')
    .update({
      is_active: true,
      updated_at: now,
    })
    .eq('id', id)
    .eq('is_active', false)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('복구할 자료를 찾을 수 없습니다.')
}

function isMissingStorageObject(
  error: { message?: string | undefined; statusCode?: string | undefined } | null
): boolean {
  const message = (error?.message || '').toLowerCase()
  const status = String(error?.statusCode || '')
  return status === '404' || /not found|does not exist|no such file/i.test(message)
}

export async function hardDeleteTourMaterial(
  sb: SupabaseClient,
  material: { id: string; file_path: string }
): Promise<void> {
  if (material.file_path) {
    const { error: storageError } = await sb.storage
      .from('tour-materials')
      .remove([material.file_path])
    if (storageError && !isMissingStorageObject(storageError)) {
      throw storageError
    }
  }

  const { error } = await sb.from('tour_materials').delete().eq('id', material.id)
  if (error) throw error
}
