import Dexie, { type Table } from 'dexie'

export interface GuideSnapshotRecord {
  cacheKey: string
  payload: unknown
  updatedAt: number
}

export interface GuideMediaRecord {
  filePath: string
  blob: Blob
  mimeType: string
  fileSize: number
  sourceUpdatedAt: string
  cachedAt: number
}

export interface PendingNarrationPlayRecord {
  id: string
  tourId: string
  materialId: string
  materialTitle: string
  filePath: string
  playedAs: 'guide' | 'assistant' | 'driver'
  playSeconds: number
  newSession: boolean
  createdAt: number
}

class GuideOfflineDexie extends Dexie {
  snapshots!: Table<GuideSnapshotRecord, string>
  media!: Table<GuideMediaRecord, string>
  pendingNarrationPlays!: Table<PendingNarrationPlayRecord, string>

  constructor() {
    super('maniatur_guide_offline')
    this.version(1).stores({
      snapshots: 'cacheKey, updatedAt',
    })
    this.version(2).stores({
      snapshots: 'cacheKey, updatedAt',
      media: 'filePath, cachedAt',
    })
    this.version(3).stores({
      snapshots: 'cacheKey, updatedAt',
      media: 'filePath, cachedAt',
      pendingNarrationPlays: 'id, createdAt',
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

export async function getGuideMedia(filePath: string): Promise<GuideMediaRecord | undefined> {
  if (!db) return undefined
  return db.media.get(filePath)
}

export async function saveGuideMedia(record: GuideMediaRecord): Promise<void> {
  if (!db) return
  await db.media.put(record)
}

export async function listGuideMediaPaths(): Promise<string[]> {
  if (!db) return []
  return db.media.toCollection().primaryKeys()
}

export async function deleteGuideMediaNotIn(keepPaths: Set<string>): Promise<void> {
  if (!db) return
  const stored = await db.media.toCollection().primaryKeys()
  const stale = stored.filter((path) => !keepPaths.has(path))
  if (stale.length > 0) {
    await db.media.bulkDelete(stale)
  }
}

export async function enqueuePendingNarrationPlay(record: PendingNarrationPlayRecord): Promise<void> {
  if (!db) return
  await db.pendingNarrationPlays.put(record)
}

export async function listPendingNarrationPlays(): Promise<PendingNarrationPlayRecord[]> {
  if (!db) return []
  return db.pendingNarrationPlays.orderBy('createdAt').toArray()
}

export async function deletePendingNarrationPlay(id: string): Promise<void> {
  if (!db) return
  await db.pendingNarrationPlays.delete(id)
}
