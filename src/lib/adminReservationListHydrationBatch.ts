/**
 * card-week 백그라운드 청크용 하이드레이션 배치.
 * 청크마다 pricing/tours/options/customers를 치지 않고 debounce·행 수 기준으로 묶어 1회 조회한다.
 */

export type AdminListHydrationBatchProgress = {
  current: number
  total: number | null
}

export type AdminListHydrationBatchOptions = {
  debounceMs?: number
  /** 이 행 수 이상 쌓이면 debounce를 기다리지 않고 즉시 flush */
  maxBatchRows?: number
  isCurrent: () => boolean
  mergePrefetch: (rows: Record<string, unknown>[]) => Promise<void>
  mergeHydrate: (
    rows: Record<string, unknown>[],
    listProgress: AdminListHydrationBatchProgress
  ) => Promise<void>
}

export type AdminListHydrationBatch = {
  enqueue: (
    rows: Record<string, unknown>[],
    progress: AdminListHydrationBatchProgress
  ) => void | Promise<void>
  flush: () => Promise<void>
  dispose: () => void
}

export function createAdminListHydrationBatch(
  opts: AdminListHydrationBatchOptions
): AdminListHydrationBatch {
  const debounceMs = opts.debounceMs ?? 350
  const maxBatchRows = opts.maxBatchRows ?? 1000
  let queue: Record<string, unknown>[] = []
  let lastProgress: AdminListHydrationBatchProgress | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let flushPromise: Promise<void> | null = null

  const clearTimer = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const flush = async () => {
    clearTimer()
    if (flushPromise) {
      await flushPromise
    }
    if (queue.length === 0) return
    if (!opts.isCurrent()) {
      queue = []
      lastProgress = null
      return
    }
    const rows = queue
    const progress = lastProgress ?? { current: rows.length, total: rows.length }
    queue = []
    lastProgress = null
    flushPromise = (async () => {
      await opts.mergePrefetch(rows)
      if (!opts.isCurrent()) return
      await opts.mergeHydrate(rows, progress)
    })()
    try {
      await flushPromise
    } finally {
      flushPromise = null
    }
  }

  const enqueue = (
    rows: Record<string, unknown>[],
    progress: AdminListHydrationBatchProgress
  ) => {
    if (rows.length === 0) return
    queue.push(...rows)
    lastProgress = progress
    if (queue.length >= maxBatchRows) {
      void flush()
      return
    }
    clearTimer()
    timer = setTimeout(() => {
      void flush()
    }, debounceMs)
  }

  const dispose = () => {
    clearTimer()
    queue = []
    lastProgress = null
  }

  return { enqueue, flush, dispose }
}
