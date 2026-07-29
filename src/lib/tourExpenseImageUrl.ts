import { supabase } from '@/lib/supabase'

export function resolveTourExpensePublicImageUrl(expense: {
  image_url?: string | null
  file_path?: string | null
}): string | null {
  const direct = String(expense.image_url || '').trim()
  if (direct) return direct
  const filePath = String(expense.file_path || '').trim()
  if (!filePath) return null
  const { data } = supabase.storage.from('tour-expenses').getPublicUrl(filePath)
  return data.publicUrl || null
}
