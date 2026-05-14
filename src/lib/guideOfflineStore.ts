import Dexie, { type Table } from 'dexie'

export interface GuideSnapshotRecord {
  cacheKey: string
  payload: unknown
  updatedAt: number
}

class GuideOfflineDexie extends Dexie {
  snapshots!: Table<GuideSnapshotRecord, string>

  constructor() {
    super('maniatur_guide_offline')
    this.version(1).stores({
      snapshots: 'cacheKey, updatedAt',
    })
  }
}

const db = typeof window === 'undefined' ? null : new GuideOfflineDexie()

export async function saveGuideSnapshot(cacheKey: string, payload: unknown): Promise<void> {
  if (!db) return
  await db.snapshots.put({
    cacheKey,
    payload,
    updatedAt: Date.now(),
  })
}

export async function loadGuideSnapshot(cacheKey: string): Promise<unknown | undefined> {
  if (!db) return undefined
  const row = await db.snapshots.get(cacheKey)
  return row?.payload
}

export async function deleteGuideSnapshot(cacheKey: string): Promise<void> {
  if (!db) return
  await db.snapshots.delete(cacheKey)
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
