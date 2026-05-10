import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 투어 지출 영수증 이미지 바이트 로드 (공개 URL 우선, 실패 시 tour-expenses Storage).
 * 브라우저에서만 사용 (fetch + supabase.storage).
 */
export async function loadTourExpenseReceiptImageBytes(
  supabase: SupabaseClient,
  params: { imageUrl: string | null | undefined; filePath: string | null | undefined },
  signal?: AbortSignal
): Promise<{ buffer: ArrayBuffer; mime: string }> {
  const url = params.imageUrl?.trim()
  if (url) {
    try {
      const imgRes = await fetch(url, { mode: 'cors', cache: 'no-store', signal })
      if (imgRes.ok) {
        const mime = imgRes.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
        const buffer = await imgRes.arrayBuffer()
        if (buffer.byteLength > 0) return { buffer, mime }
      }
    } catch {
      /* Storage 폴백 */
    }
  }

  const fp = params.filePath?.trim()
  if (fp) {
    const { data, error } = await supabase.storage.from('tour-expenses').download(fp)
    if (!error && data && data.size > 0) {
      const mime =
        data.type && data.type !== 'application/octet-stream' ? data.type : 'image/jpeg'
      return { buffer: await data.arrayBuffer(), mime }
    }
  }

  throw new Error('RECEIPT_IMAGE_LOAD_FAILED')
}
