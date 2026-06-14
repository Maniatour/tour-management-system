/** URLSearchParams에서 동일 키·쉼표 구분 다중 값 파싱 */
export function parseMultiQueryValues(searchParams: URLSearchParams, key: string): string[] {
  const parts: string[] = []
  for (const raw of searchParams.getAll(key)) {
    for (const piece of raw.split(',')) {
      const t = piece.trim()
      if (t) parts.push(t)
    }
  }
  return [...new Set(parts)]
}

export function appendMultiQueryValues(params: URLSearchParams, key: string, values: Iterable<string>): void {
  for (const v of values) {
    const t = v.trim()
    if (t) params.append(key, t)
  }
}
