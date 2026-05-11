import { supabase } from '@/lib/supabase'
import { ensureFreshAuthSessionForUpload } from '@/lib/uploadClient'
import { createThumbnail, getThumbnailFileName } from '@/lib/imageUtils'
import {
  dedupeFilesByContent,
  runWithConcurrency,
  tourPhotoMetadataKey,
  withUploadRetries,
} from '@/lib/tourPhotoUploadUtils'
import {
  endTourPhotoUploadSession,
  startTourPhotoUploadSession,
  updateTourPhotoUploadProgress,
} from '@/lib/tourPhotoUploadSession'

export type TourPhotoUploadQueueParams = {
  files: File[]
  tourId: string
  uploadedBy: string
  imageOnlyErrorLabel: string
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

/**
 * 투어 사진 다중 업로드 (전역 진행 세션 사용 — 페이지 이동 후에도 Promise는 계속 실행됨)
 */
export async function runTourPhotoUploadQueue(
  params: TourPhotoUploadQueueParams
): Promise<TourPhotoUploadQueueResult> {
  const { files, tourId, uploadedBy, imageOnlyErrorLabel } = params

  const empty: TourPhotoUploadQueueResult = {
    totalSuccessful: 0,
    totalFailed: 0,
    failedFiles: [],
    skippedDuplicateContent: 0,
    skippedAlreadyUploaded: 0,
  }

  if (!files.length) {
    endTourPhotoUploadSession()
    return { ...empty, userMessages: ['파일이 선택되지 않았습니다.'] }
  }

  let totalSuccessful = 0
  let totalFailed = 0
  const failedFiles: string[] = []
  let skippedDuplicateContent = 0
  let skippedAlreadyUploaded = 0

  try {
    await ensureFreshAuthSessionForUpload()

    const { data: existingRows } = await supabase
      .from('tour_photos')
      .select('file_name, file_size')
      .eq('tour_id', tourId)

    const existingMeta = new Set(
      (existingRows || []).map((r: { file_name: string; file_size: number }) => `${r.file_name}\0${r.file_size}`)
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
        parts.push(`선택한 사진 중 동일한 이미지 ${skippedDuplicateContent}장은 한 번만 올립니다.`)
      }
      if (skippedAlreadyUploaded > 0) {
        parts.push(`이미 이 투어에 올라간 사진과 같은 파일(이름·크기) ${skippedAlreadyUploaded}장은 건너뛰었습니다.`)
      }
      return {
        ...empty,
        skippedDuplicateContent,
        skippedAlreadyUploaded,
        userMessages: parts.length > 0 ? [parts.join('\n')] : ['업로드할 새 사진이 없습니다.'],
      }
    }

    let completed = 0

    startTourPhotoUploadSession(tourId, toUpload.length)

    const onBeforeRetry = async () => {
      await ensureFreshAuthSessionForUpload().catch(() => {})
    }

    try {
      await runWithConcurrency(toUpload, 4, async (file) => {
      try {
        await withUploadRetries(
          async () => {
            if (file.size > 50 * 1024 * 1024) {
              throw new Error(`파일 크기가 너무 큽니다: ${file.name} (최대 50MB)`)
            }
            if (!file.type.startsWith('image/')) {
              throw new Error(`${imageOnlyErrorLabel}: ${file.name}`)
            }

            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
            const filePath = `${tourId}/${fileName}`

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('tour-photos')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
              })

            if (uploadError) throw uploadError
            if (!uploadData?.path) throw new Error('Storage upload returned no path')

            let thumbnailPath: string | null = null
            try {
              const thumbnailBlob = await createThumbnail(file, 400, 400, 0.8)
              const thumbnailFileName = getThumbnailFileName(fileName)
              thumbnailPath = `${tourId}/${thumbnailFileName}`
              const thumbnailFile = new File([thumbnailBlob], thumbnailFileName, { type: 'image/jpeg' })
              const { error: thumbnailUploadError } = await supabase.storage
                .from('tour-photos')
                .upload(thumbnailPath, thumbnailFile, {
                  cacheControl: '3600',
                  upsert: false,
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
                mime_type: file.type,
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
