/** 한 줄 요약 — Next 오버레이·콘솔에서 빈 `{}`로만 보이는 경우 방지 */
export function describeError(err: unknown): string {
  if (err == null) return String(err)
  if (err instanceof Error) return `${err.name}: ${err.message || '(no message)'}`
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    const bits = ['message', 'code', 'details', 'hint', 'status']
      .map((k) => {
        const v = o[k]
        if (v == null || v === '') return null
        return `${k}=${String(v)}`
      })
      .filter(Boolean)
    if (bits.length) return bits.join(' ')
    try {
      const s = JSON.stringify(err)
      if (s && s !== '{}') return s
    } catch {
      /* ignore */
    }
    const names = Object.getOwnPropertyNames(err)
    if (names.length) {
      try {
        const shallow: Record<string, unknown> = {}
        for (const n of names) shallow[n] = (err as Record<string, unknown>)[n]
        const s2 = JSON.stringify(shallow)
        if (s2 && s2 !== '{}') return s2
      } catch {
        /* ignore */
      }
    }
  }
  const s = String(err)
  if (s !== '') return s
  return Object.prototype.toString.call(err)
}

/** Supabase/Error 객체를 로깅 가능한 형태로 변환 (비열거형·빈 객체·String([])=='' 보완) */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err == null) return { _raw: String(err) }
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message || '(no message)',
    }
    if (err.stack) out.stack = err.stack
    return out
  }
  if (typeof err === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.getOwnPropertyNames(err as object)) {
      try {
        const v = (err as Record<string, unknown>)[key]
        if (v !== undefined) out[key] = v
      } catch {
        /* ignore */
      }
    }
    if (Object.keys(out).length > 0) return out
    try {
      const s = JSON.stringify(err)
      if (s && s !== '{}') return { _json: s }
    } catch {
      /* ignore */
    }
    return { _summary: describeError(err) }
  }
  const s = String(err)
  return s !== '' ? { _raw: s } : { _type: typeof err, _tag: Object.prototype.toString.call(err) }
}
