import { supabase } from '@/lib/supabase'

/**
 * 통합 PNL 지출 상세에서 사용자가 "중복 아님"으로 처리한 지출 키(source:id) 목록.
 * `batches`는 클릭마다 한 묶음 — «마지막 작업 되돌리기»용.
 */
const SETTING_KEY = 'pnl_duplicate_dismissed'

type DismissedStoredValue = {
  keys?: unknown
  batches?: unknown
}

type DismissedDuplicateState = {
  keys: Set<string>
  batches: string[][]
}

function normalizeBatch(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

function keysFromBatches(batches: string[][]): Set<string> {
  return new Set(batches.flat())
}

async function loadDismissedDuplicateState(): Promise<DismissedDuplicateState> {
  try {
    const { data, error } = await supabase
      .from('shared_settings')
      .select('setting_value')
      .eq('setting_key', SETTING_KEY)
      .maybeSingle()
    if (error || !data?.setting_value) return { keys: new Set(), batches: [] }

    const val = data.setting_value as DismissedStoredValue
    const flatKeys = Array.isArray(val.keys)
      ? val.keys.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : []
    let batches = Array.isArray(val.batches)
      ? val.batches.map(normalizeBatch).filter((b) => b.length > 0)
      : []

    /** 예전 형식(keys만) — 한 번에 숨긴 것으로 간주해 마지막 작업 되돌리기 가능 */
    if (batches.length === 0 && flatKeys.length > 0) {
      batches = [[...flatKeys]]
    }

    const keys = batches.length > 0 ? keysFromBatches(batches) : new Set(flatKeys)
    return { keys, batches }
  } catch {
    return { keys: new Set(), batches: [] }
  }
}

async function saveDismissedDuplicateState(state: DismissedDuplicateState): Promise<void> {
  const { error } = await supabase.from('shared_settings').upsert(
    {
      setting_key: SETTING_KEY,
      setting_value: {
        keys: [...state.keys],
        batches: state.batches,
      },
    },
    { onConflict: 'setting_key' }
  )
  if (error) throw error
}

export async function fetchDismissedDuplicateKeys(): Promise<Set<string>> {
  const state = await loadDismissedDuplicateState()
  return state.keys
}

export async function fetchDismissedDuplicateBatchInfo(): Promise<{
  batchCount: number
  lastBatchSize: number
}> {
  const { batches } = await loadDismissedDuplicateState()
  const last = batches.length > 0 ? batches[batches.length - 1]! : []
  return { batchCount: batches.length, lastBatchSize: last.length }
}

/** 선택한 키를 "중복 아님"으로 추가 보관(한 클릭 = 한 배치) */
export async function addDismissedDuplicateKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const state = await loadDismissedDuplicateState()
  state.batches.push([...keys])
  state.keys = keysFromBatches(state.batches)
  await saveDismissedDuplicateState(state)
}

/** "중복 아님" 처리 취소(다시 중복 탐지 대상으로) */
export async function removeDismissedDuplicateKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const toRemove = new Set(keys)
  const state = await loadDismissedDuplicateState()
  state.batches = state.batches
    .map((batch) => batch.filter((k) => !toRemove.has(k)))
    .filter((b) => b.length > 0)
  state.keys = keysFromBatches(state.batches)
  await saveDismissedDuplicateState(state)
}

/** 가장 최근 «중복 아님» 클릭 한 번만 되돌림 — 복원된 키 개수 반환 */
export async function undoLastDismissedDuplicateBatch(): Promise<number> {
  const state = await loadDismissedDuplicateState()
  if (state.batches.length === 0) return 0
  const lastBatch = state.batches.pop()!
  const keysBefore = new Set(state.keys)
  state.keys = keysFromBatches(state.batches)
  await saveDismissedDuplicateState(state)
  let restored = 0
  for (const k of lastBatch) {
    if (keysBefore.has(k) && !state.keys.has(k)) restored += 1
  }
  return restored
}

/** «중복 아님» 처리 전체 되돌리기 */
export async function clearAllDismissedDuplicateKeys(): Promise<number> {
  const state = await loadDismissedDuplicateState()
  const count = state.keys.size
  if (count === 0) return 0
  await saveDismissedDuplicateState({ keys: new Set(), batches: [] })
  return count
}
