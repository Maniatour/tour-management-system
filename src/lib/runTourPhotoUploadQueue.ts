import { supabase } from '@/lib/supabase'
import { ensureFreshAuthSessionForUpload } from '@/lib/uploadClient'
import {
  createThumbnail,
  createVideoThumbnail,
  getJpegThumbnailFileName,
  getThumbnailFileName,
} from '@/lib/imageUtils'
import {
  dedupeFilesByContent,
  inferTourPhotoMimeType,
  isLikelyTourMediaFile,
  isLikelyTourVideoFile,
  runWithConcurrency,
  tourPhotoMaxBytesForFile,
  tourPhotoMetadataKey,
  tourPhotoStorageExtension,
  withUploadRetries,
} from '@/lib/tourPhotoUploadUtils'
import {
  endTourPhotoUploadSession,
  startTourPhotoUploadSession,
  updateTourPhotoUploadProgress,
} from '@/lib/tourPhotoUploadSession'

export type TourPhotoUploadQueueLabels = {
  noFiles: string
  mediaOnlyError: string
  fileTooLarge: string
  duplicateInSelection: string
  alreadyUploaded: string
  nothingToUpload: string
}

export type TourPhotoUploadQueueParams = {
  files: File[]
  tourId: string
  uploadedBy: string
  labels: TourPhotoUploadQueueLabels
}

export type TourPhotoUploadQueueResult = {
  totalSuccessful: number
  totalFailed: number
  failedFiles: string[]
  skippedDuplicateContent: number
  skippedAlreadyUploaded: number
  /** 즉시 사용자에게 보여줄 메시지 (업로드할 파일 없음 등) */
  userMessages?: string[]
}

const FINISHED_EVENT = 'tour-photo-upload-finished'

export function dispatchTourPhotoUploadFinished(tourId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(FINISHED_EVENT, { detail: { tourId } }))
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}

/**
 * 투어 사진·영상 다중 업로드 (전역 진행 세션 사용 — 페이지 이동 후에도 Promise는 계속 실행됨)
 */
export async function runTourPhotoUploadQueue(
  params: TourPhotoUploadQueueParams
): Promise<TourPhotoUploadQueueResult> {
  const { files, tourId, uploadedBy, labels } = params

  const empty: TourPhotoUploadQueueResult = {
    totalSuccessful: 0,
    totalFailed: 0,
    failedFiles: [],
    skippedDuplicateContent: 0,
    skippedAlreadyUploaded: 0,
  }

  if (!files.length) {
    endTourPhotoUploadSession()
    return { ...empty, userMessages: [labels.noFiles] }
  }

  let totalSuccessful = 0
  let totalFailed = 0
  const failedFiles: string[] = []
  let skippedDuplicateContent = 0
  let skippedAlreadyUploaded = 0

  try {
    await ensureFreshAuthSessionForUpload()

    const pageSize = 1000
    const existingRows: Array<{ file_name: string; file_size: number }> = []
    let from = 0
    for (;;) {
      const { data: page } = await supabase
        .from('tour_photos')
        .select('file_name, file_size')
        .eq('tour_id', tourId)
        .range(from, from + pageSize - 1)
      if (!page?.length) break
      existingRows.push(...page)
      if (page.length < pageSize) break
      from += pageSize
    }

    const existingMeta = new Set(
      existingRows.map((r) => `${r.file_name}\0${r.file_size}`)
    )

    const deduped = await dedupeFilesByContent(files)
    skippedDuplicateContent = deduped.skippedDuplicateContent
    const contentUnique = deduped.unique

    const toUpload: File[] = []
    skippedAlreadyUploaded = 0
    for (const f of contentUnique) {
      if (existingMeta.has(tourPhotoMetadataKey(f))) {
        skippedAlreadyUploaded += 1
      } else {
        toUpload.push(f)
      }
    }

    if (toUpload.length === 0) {
      endTourPhotoUploadSession()
      const parts: string[] = []
      if (skippedDuplicateContent > 0) {
        parts.push(interpolate(labels.duplicateInSelection, { count: skippedDuplicateContent }))
      }
      if (skippedAlreadyUploaded > 0) {
        parts.push(interpolate(labels.alreadyUploaded, { count: skippedAlreadyUploaded }))
      }
      return {
        ...empty,
        skippedDuplicateContent,
        skippedAlreadyUploaded,
        userMessages: parts.length > 0 ? [parts.join('\n')] : [labels.nothingToUpload],
      }
    }

    let completed = 0

    startTourPhotoUploadSession(tourId, toUpload.length)

    const onBeforeRetry = async () => {
      await ensureFreshAuthSessionForUpload().catch(() => {})
    }

    const hasLargeVideo = toUpload.some(
      (file) => isLikelyTourVideoFile(file) && file.size > 20 * 1024 * 1024
    )
    const concurrency = hasLargeVideo ? 2 : 4

    try {
      await runWithConcurrency(toUpload, concurrency, async (file) => {
      try {
        await withUploadRetries(
          async () => {
            const maxBytes = tourPhotoMaxBytesForFile(file)
            if (file.size > maxBytes) {
              const maxMb = Math.round(maxBytes / (1024 * 1024))
              throw new Error(interpolate(labels.fileTooLarge, { name: file.name, maxMb }))
            }
            if (!isLikelyTourMediaFile(file)) {
              throw new Error(`${labels.mediaOnlyError}: ${file.name}`)
            }

            const isVideo = isLikelyTourVideoFile(file)
            const resolvedMime = inferTourPhotoMimeType(file)
            const safeExt = tourPhotoStorageExtension(file)
            const fileName = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`
            const filePath = `${tourId}/${fileName}`

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('tour-photos')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: resolvedMime,
              })

            if (uploadError) throw uploadError
            if (!uploadData?.path) throw new Error('Storage upload returned no path')

            let thumbnailPath: string | null = null
            try {
              const thumbnailBlob = isVideo
                ? await createVideoThumbnail(file, 400, 400, 0.8)
                : await createThumbnail(file, 400, 400, 0.8)
              const thumbnailFileName = isVideo
                ? getJpegThumbnailFileName(fileName)
                : getThumbnailFileName(fileName)
              thumbnailPath = `${tourId}/${thumbnailFileName}`
              const thumbnailFile = new File([thumbnailBlob], thumbnailFileName, { type: 'image/jpeg' })
              const { error: thumbnailUploadError } = await supabase.storage
                .from('tour-photos')
                .upload(thumbnailPath, thumbnailFile, {
                  cacheControl: '3600',
                  upsert: false,
                  contentType: 'image/jpeg',
                })
              if (thumbnailUploadError) thumbnailPath = null
            } catch {
              thumbnailPath = null
            }

            const shareToken = crypto.randomUUID()

            const { data: photoData, error: dbError } = await supabase
              .from('tour_photos')
              .insert({
                tour_id: tourId,
                file_path: uploadData.path,
                file_name: file.name,
                file_size: file.size,
                mime_type: resolvedMime.slice(0, 100),
                uploaded_by: uploadedBy,
                share_token: shareToken,
                thumbnail_path: thumbnailPath,
              })
              .select()
              .single()

            if (dbError) {
              await supabase.storage.from('tour-photos').remove([uploadData.path])
              if (thumbnailPath) await supabase.storage.from('tour-photos').remove([thumbnailPath])
              throw dbError
            }
            if (!photoData) throw new Error('No row returned from tour_photos insert')
          },
          { attempts: 4, baseDelayMs: 500, onBeforeRetry }
        )
        totalSuccessful += 1
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error)
        failedFiles.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`)
        totalFailed += 1
      } finally {
        completed += 1
        updateTourPhotoUploadProgress(completed, toUpload.length)
      }
      })
    } finally {
      endTourPhotoUploadSession()
    }

    if (totalSuccessful > 0) {
      dispatchTourPhotoUploadFinished(tourId)
    }

    return {
      totalSuccessful,
      totalFailed,
      failedFiles,
      skippedDuplicateContent,
      skippedAlreadyUploaded,
    }
  } catch (error) {
    endTourPhotoUploadSession()
    throw error
  }
}
