import { supabase } from '@/lib/supabase'

const TOUR_EXPENSE_BUCKET = 'tour-expenses'

/** DB의 file_path 또는 공개/서명 URL에서 Storage object key만 꺼낸다. */
export function normalizeTourExpenseStoragePath(
  filePathOrUrl: string | null | undefined
): string | null {
  let p = String(filePathOrUrl || '').trim()
  if (!p) return null
  if (/^https?:\/\//i.test(p)) {
    try {
      const pathname = decodeURIComponent(new URL(p).pathname)
      const markers = [
        `/storage/v1/object/public/${TOUR_EXPENSE_BUCKET}/`,
        `/storage/v1/object/sign/${TOUR_EXPENSE_BUCKET}/`,
        `/storage/v1/object/authenticated/${TOUR_EXPENSE_BUCKET}/`,
        `/storage/v1/object/${TOUR_EXPENSE_BUCKET}/`,
      ]
      let extracted: string | null = null
      for (const marker of markers) {
        const idx = pathname.indexOf(marker)
        if (idx >= 0) {
          extracted = pathname.slice(idx + marker.length)
          break
        }
      }
      if (extracted == null) return null
      p = extracted
    } catch {
      return null
    }
  }
  p = p.replace(/^\/+/, '').split('?')[0].split('#')[0]
  return p || null
}

export function resolveTourExpensePublicImageUrl(expense: {
  image_url?: string | null
  file_path?: string | null
}): string | null {
  const direct = String(expense.image_url || '').trim()
  if (direct) return direct
  const filePath = normalizeTourExpenseStoragePath(expense.file_path)
  if (!filePath) return null
  const { data } = supabase.storage.from(TOUR_EXPENSE_BUCKET).getPublicUrl(filePath)
  return data.publicUrl || null
}
