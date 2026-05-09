/**
 * PostgREST `.in()` 조회를 URL 길이 제한을 피하기 위해 쪼개되,
 * 청크마다 순차 await 하면 왕복 지연이 기간·건수에 비례해 커짐.
 * 청크 단위로 제한된 병렬만큼만 동시에 요청해 총 대기 시간을 줄인다.
 */
export async function mapIdsInConcurrentChunks<T>(
  ids: string[],
  chunkSize: number,
  maxConcurrentChunks: number,
  fetchChunk: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize))
  }
  const out: T[] = []
  const conc = Math.max(1, maxConcurrentChunks)
  for (let i = 0; i < chunks.length; i += conc) {
    const slice = chunks.slice(i, i + conc)
    const batch = await Promise.all(slice.map((c) => fetchChunk(c)))
    for (const rows of batch) out.push(...rows)
  }
  return out
}
