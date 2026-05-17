/** PostgREST GET `id=in.(…)` URL 길이 한도 — 배치 조회용 (select=* 등 넓은 select 시 보수적) */
export const SUPABASE_IN_FILTER_CHUNK_SIZE = 120

export function chunkStrings(
  ids: Iterable<string>,
  chunkSize: number = SUPABASE_IN_FILTER_CHUNK_SIZE
): string[][] {
  const unique = [...new Set([...ids].map((id) => String(id ?? '').trim()).filter(Boolean))]
  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += chunkSize) {
    chunks.push(unique.slice(i, i + chunkSize))
  }
  return chunks
}
