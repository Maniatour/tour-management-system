/**
 * 페이지 전환 직후가 아닌, 브라우저 idle 시점에 부가 작업을 실행합니다.
 */
export function scheduleDeferredWork(work: () => void, maxWaitMs = 2500): () => void {
  if (typeof window === 'undefined') {
    work()
    return () => {}
  }

  let cancelled = false
  const run = () => {
    if (!cancelled) work()
  }

  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(run, { timeout: maxWaitMs })
    return () => {
      cancelled = true
      window.cancelIdleCallback(idleId)
    }
  }

  const timeoutId = window.setTimeout(run, Math.min(maxWaitMs, 800))
  return () => {
    cancelled = true
    window.clearTimeout(timeoutId)
  }
}
