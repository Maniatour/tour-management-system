import { supabase } from '@/lib/supabase'
import {
  deleteGuideMediaNotIn,
  getGuideMedia,
  isBrowserOffline,
  listGuideMediaPaths,
  saveGuideMedia,
  saveGuideSnapshot,
} from '@/lib/guideOfflineStore'

export const GUIDE_NARRATION_SNAPSHOT_KEY = 'guide:tour-materials:audio'

export type GuideNarrationMaterial = {
  id: string
  title: string
  description: string | null
  attraction_id: string | null
  category_id: string | null
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  mime_type: string
  duration: number | null
  language: string | null
  tags: string[] | null
  is_active: boolean
  is_public: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  tour_attractions?: { name_ko: string; name_en: string } | null
  tour_material_categories?: { name_ko: string; name_en: string; icon: string; color: string } | null
}

export type NarrationOfflineStatus = {
  status: 'idle' | 'syncing' | 'ready' | 'partial' | 'error'
  cached: number
  total: number
}

const objectUrls = new Map<string, string>()
const listeners = new Set<() => void>()
let syncPromise: Promise<void> | null = null
let status: NarrationOfflineStatus = { status: 'idle', cached: 0, total: 0 }

function emit() {
  listeners.forEach((fn) => fn())
}

function setStatus(next: NarrationOfflineStatus) {
  status = next
  emit()
}

export function getNarrationOfflineStatus(): NarrationOfflineStatus {
  return status
}

export function subscribeNarrationOfflineStatus(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function getTourMaterialPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from('tour-materials').getPublicUrl(filePath)
  return data.publicUrl
}

function objectUrlFor(filePath: string, blob: Blob): string {
  const existing = objectUrls.get(filePath)
  if (existing) return existing
  const url = URL.createObjectURL(blob)
  objectUrls.set(filePath, url)
  return url
}

function replaceObjectUrl(filePath: string, blob: Blob): string {
  const existing = objectUrls.get(filePath)
  if (existing) URL.revokeObjectURL(existing)
  objectUrls.delete(filePath)
  return objectUrlFor(filePath, blob)
}

async function fetchAudioMaterials(): Promise<GuideNarrationMaterial[]> {
  const { data, error } = await supabase
    .from('tour_materials')
    .select(
      `
      *,
      tour_attractions(name_ko, name_en),
      tour_material_categories(name_ko, name_en, icon, color)
    `,
    )
    .eq('file_type', 'audio')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as GuideNarrationMaterial[]
}

async function cacheAudioFile(material: GuideNarrationMaterial): Promise<boolean> {
  const existing = await getGuideMedia(material.file_path)
  if (existing && existing.sourceUpdatedAt === material.updated_at) {
    objectUrlFor(material.file_path, existing.blob)
    return true
  }

  const { data, error } = await supabase.storage.from('tour-materials').download(material.file_path)
  if (error || !data) return false

  const mimeType = data.type || material.mime_type || 'audio/mpeg'
  const blob = data.type ? data : new Blob([data], { type: mimeType })
  try {
    await saveGuideMedia({
      filePath: material.file_path,
      blob,
      mimeType,
      fileSize: blob.size,
      sourceUpdatedAt: material.updated_at,
      cachedAt: Date.now(),
    })
  } catch (error) {
    console.warn('[guide narration] storage quota', material.file_path, error)
    return false
  }
  replaceObjectUrl(material.file_path, blob)
  return true
}

async function refreshCachedCount(total: number) {
  const paths = await listGuideMediaPaths()
  const cached = paths.length
  setStatus({
    status: cached >= total && total > 0 ? 'ready' : cached > 0 ? 'partial' : 'idle',
    cached,
    total,
  })
}

export async function syncGuideNarrationOffline(): Promise<void> {
  if (typeof window === 'undefined') return
  if (isBrowserOffline()) {
    const paths = await listGuideMediaPaths()
    setStatus({
      status: paths.length > 0 ? (status.total > 0 && paths.length >= status.total ? 'ready' : 'partial') : 'idle',
      cached: paths.length,
      total: Math.max(status.total, paths.length),
    })
    return
  }
  if (syncPromise) return syncPromise

  syncPromise = (async () => {
    try {
      const materials = await fetchAudioMaterials()
      await saveGuideSnapshot(GUIDE_NARRATION_SNAPSHOT_KEY, materials)
      const keep = new Set(materials.map((item) => item.file_path))
      await deleteGuideMediaNotIn(keep)

      const cachedPaths = new Set(await listGuideMediaPaths())
      setStatus({ status: 'syncing', cached: cachedPaths.size, total: materials.length })

      const pending = materials.filter((item) => !cachedPaths.has(item.file_path))
      const stale = materials.filter((item) => cachedPaths.has(item.file_path))
      for (const item of stale) {
        await cacheAudioFile(item)
      }

      const queue = pending
      let cursor = 0
      const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
        while (cursor < queue.length) {
          const item = queue[cursor]
          cursor += 1
          try {
            await cacheAudioFile(item)
          } catch (error) {
            console.warn('[guide narration] cache failed', item.file_path, error)
          }
          const cached = (await listGuideMediaPaths()).length
          setStatus({
            status: 'syncing',
            cached,
            total: materials.length,
          })
        }
      })
      await Promise.all(workers)
      await refreshCachedCount(materials.length)
    } catch (error) {
      console.warn('[guide narration] sync failed', error)
      const paths = await listGuideMediaPaths()
      setStatus({
        status: paths.length > 0 ? 'partial' : 'error',
        cached: paths.length,
        total: status.total,
      })
    }
  })().finally(() => {
    syncPromise = null
  })

  return syncPromise
}

export async function resolveNarrationPlaybackSrc(filePath: string): Promise<string | null> {
  const memory = objectUrls.get(filePath)
  if (memory) return memory
  const cached = await getGuideMedia(filePath)
  if (cached?.blob) {
    return objectUrlFor(filePath, cached.blob)
  }
  if (isBrowserOffline()) return null
  return getTourMaterialPublicUrl(filePath)
}
