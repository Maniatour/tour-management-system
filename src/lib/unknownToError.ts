/**
 * catch 블록의 unknown 값을 표시·상태 저장용 Error로 바꿉니다.
 * Supabase PostgrestError, 빈 객체 `{}`, 문자열 등을 처리합니다.
 */
export function unknownToError(err: unknown): Error {
  if (err instanceof Error) return err
  if (err == null) {
    return new Error('알 수 없는 오류가 발생했습니다.')
  }
  if (typeof err === 'string') {
    return new Error(err)
  }
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    const parts: string[] = []
    if (typeof o.message === 'string' && o.message.trim()) {
      parts.push(o.message.trim())
    }
    if (o.code != null && String(o.code).length) {
      parts.push(`code: ${String(o.code)}`)
    }
    if (o.details != null && String(o.details).length) {
      parts.push(String(o.details))
    }
    if (o.hint != null && String(o.hint).length) {
      parts.push(`hint: ${String(o.hint)}`)
    }
    if (parts.length > 0) {
      return new Error(parts.join(' — '))
    }
    try {
      const json = JSON.stringify(o, Object.getOwnPropertyNames(o))
      if (json && json !== '{}') {
        return new Error(json)
      }
    } catch {
      /* ignore */
    }
    return new Error(
      '요청이 실패했습니다. 응답에 오류 상세가 없습니다. 네트워크 탭·Supabase RLS·환경 변수를 확인하세요.'
    )
  }
  return new Error(String(err))
}

/** console / 로깅용: 비열거 속성·Postgrest 필드를 포함해 직렬화합니다. */
export function serializeUnknownError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      kind: 'Error',
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause !== undefined ? serializeUnknownError(err.cause) : undefined
    }
  }
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    const out: Record<string, unknown> = { kind: 'object' }
    for (const key of Object.getOwnPropertyNames(o)) {
      try {
        const v = o[key]
        out[key] = v instanceof Error ? { name: v.name, message: v.message } : v
      } catch {
        out[key] = '[unreadable]'
      }
    }
    return out
  }
  return { kind: typeof err, value: err }
}
