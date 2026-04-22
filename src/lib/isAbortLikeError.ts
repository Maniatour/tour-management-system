/** fetch/Supabase 요청 취소(언마운트, Fast Refresh 등) — 실패로 취급하지 않음 */
export function isAbortLikeError(err: unknown): boolean {
  if (err == null) return false
  if (typeof err === 'object' && 'name' in err && (err as Error).name === 'AbortError')
    return true
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          (err as { message: unknown }).message != null
        ? String((err as { message: string }).message)
        : String(err)
  const details =
    typeof err === 'object' &&
    err !== null &&
    'details' in err &&
    (err as { details: unknown }).details != null
      ? String((err as { details: string }).details)
      : ''
  const s = `${msg} ${details}`
  return (
    s.includes('AbortError') ||
    s.includes('aborted') ||
    s.includes('signal is aborted')
  )
}
