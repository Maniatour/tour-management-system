'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Check, Image as ImageIcon, Loader2, Receipt, RefreshCw, X, WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { fetchApiWithAuthWhenReady } from '@/lib/api-client-bearer'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'
import GuideLiveCameraOverlay from '@/components/guide/GuideLiveCameraOverlay'
import { openGuideLiveCameraStream } from '@/lib/guideLiveCameraFocus'
import { prepareGuideQuickPhoto } from '@/lib/guideQuickPhotoProcess'
import { classifyGuideQuickCapture, type GuideQuickCaptureKind } from '@/lib/guideQuickPhotoClassify'
import { uploadGuideQuickReceipt } from '@/lib/guideQuickReceiptUpload'
import {
  deletePendingTourPhoto,
  enqueuePendingTourPhoto,
  isBrowserOffline,
  listPendingTourPhotos,
  type PendingTourPhotoRecord,
} from '@/lib/guideOfflineStore'
import { runTourPhotoUploadQueue } from '@/lib/runTourPhotoUploadQueue'
import { tourPhotoPublicUrl } from '@/components/tour/TourPhotoMedia'
import type { TodayPhotoThumb, TodayPhotoTourMatch } from '@/lib/guideTodayPhotoTour'

type LocalShot = {
  id: string
  previewUrl: string
  status: 'processing' | 'uploading' | 'saved' | 'queued' | 'failed'
  file?: File
  error?: string
  kind?: GuideQuickCaptureKind
  ocrText?: string
}

type TodayPhotoTourResponse = {
  ok?: boolean
  today?: string
  tour?: TodayPhotoTourMatch | null
  photoCount?: number
  recentPhotos?: TodayPhotoThumb[]
  error?: string
}

type GuideQuickPhotoSheetProps = {
  open: boolean
  onClose: () => void
  locale: string
}

export type GuideQuickPhotoSheetHandle = {
  openCamera: () => boolean
}

function isMobileCameraDevice(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

const GuideQuickPhotoSheet = forwardRef<GuideQuickPhotoSheetHandle, GuideQuickPhotoSheetProps>(
  function GuideQuickPhotoSheet({ open, onClose, locale }, ref) {
  const t = useTranslations('guide.quickPhoto')
  const tPhoto = useTranslations('tours.tourPhoto')
  const { user, simulatedUser, isSimulating } = useAuth()
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const previewUrlsRef = useRef<string[]>([])
  const tourRef = useRef<TodayPhotoTourMatch | null>(null)
  const loadingTourRef = useRef(false)
  const liveStreamRef = useRef<MediaStream | null>(null)
  const cameraRequestIdRef = useRef(0)
  const liveCameraOpenRef = useRef(false)

  const [loadingTour, setLoadingTour] = useState(false)
  const [tour, setTour] = useState<TodayPhotoTourMatch | null>(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [receiptCount, setReceiptCount] = useState(0)
  const [recentPhotos, setRecentPhotos] = useState<TodayPhotoThumb[]>([])
  const [tourError, setTourError] = useState<string | null>(null)
  const [shots, setShots] = useState<LocalShot[]>([])
  const [offline, setOffline] = useState(false)
  const [liveCameraOpen, setLiveCameraOpen] = useState(false)
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null)

  const rememberPreview = (url: string) => {
    previewUrlsRef.current.push(url)
    return url
  }

  const queueLabels = useCallback(
    () => ({
      noFiles: tPhoto('noFilesSelected'),
      mediaOnlyError: tPhoto('mediaOnlyError'),
      fileTooLarge: tPhoto('fileTooLarge'),
      duplicateInSelection: tPhoto('skippedDuplicateInSelection'),
      alreadyUploaded: tPhoto('skippedAlreadyUploaded'),
      nothingToUpload: tPhoto('nothingToUpload'),
    }),
    [tPhoto]
  )

  const loadTour = useCallback(async () => {
    setLoadingTour(true)
    setTourError(null)
    try {
      const headers: Record<string, string> = {}
      if (isSimulating && simulatedUser?.email) {
        headers['x-simulated-user-email'] = simulatedUser.email
      }
      const res = await fetchApiWithAuthWhenReady(
        `/api/guide/today-photo-tour?locale=${encodeURIComponent(locale)}`,
        { headers }
      )
      if (!res) {
        setTour(null)
        setTourError(t('authRequired'))
        return
      }
      const data = (await res.json()) as TodayPhotoTourResponse
      if (!res.ok || !data.ok) {
        setTour(null)
        setTourError(data.error || t('loadError'))
        return
      }
      setTour(data.tour ?? null)
      setPhotoCount(data.photoCount ?? 0)
      setRecentPhotos(data.recentPhotos ?? [])
      if (!data.tour) setTourError(t('noTour'))
    } catch {
      setTour(null)
      setTourError(t('loadError'))
    } finally {
      setLoadingTour(false)
    }
  }, [isSimulating, locale, simulatedUser?.email, t])

  const persistPending = useCallback(
    async (
      shotId: string,
      file: File,
      ctx: {
        tourId: string
        uploadedBy: string
        kind: GuideQuickCaptureKind
        tourDate?: string
        productId?: string | null
        ocrText?: string
      },
      error?: string
    ) => {
      const record: PendingTourPhotoRecord = {
        id: shotId,
        tourId: ctx.tourId,
        uploadedBy: ctx.uploadedBy,
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        blob: file,
        createdAt: Date.now(),
        uploadKind: ctx.kind,
      }
      if (error) record.lastError = error
      if (ctx.tourDate) record.tourDate = ctx.tourDate
      if (ctx.productId) record.productId = ctx.productId
      await enqueuePendingTourPhoto(record)
    },
    []
  )

  const markShotFailed = (shotId: string, file: File, message: string, kind: GuideQuickCaptureKind) => {
    setShots((prev) =>
      prev.map((shot) => (shot.id === shotId ? { ...shot, status: 'failed' as const, file, error: message, kind } : shot))
    )
  }

  const uploadFile = useCallback(
    async (
      shotId: string,
      file: File,
      ctx: {
        tourId: string
        uploadedBy: string
        kind: GuideQuickCaptureKind
        tourDate: string
        productId?: string | null
        ocrText?: string
      }
    ) => {
      setShots((prev) =>
        prev.map((shot) =>
          shot.id === shotId
            ? { ...shot, status: isBrowserOffline() ? 'queued' : 'uploading', file, kind: ctx.kind }
            : shot
        )
      )

      if (isBrowserOffline()) {
        await persistPending(shotId, file, ctx)
        return
      }

      try {
        if (ctx.kind === 'receipt') {
          await uploadGuideQuickReceipt({
            file,
            tourId: ctx.tourId,
            tourDate: ctx.tourDate,
            productId: ctx.productId ?? null,
            uploadedBy: ctx.uploadedBy,
            ...(ctx.ocrText ? { ocrText: ctx.ocrText } : {}),
          })
          await deletePendingTourPhoto(shotId)
          setShots((prev) =>
            prev.map((shot) => {
              if (shot.id !== shotId) return shot
              return { id: shot.id, previewUrl: shot.previewUrl, status: 'saved', kind: 'receipt' }
            })
          )
          setReceiptCount((count) => count + 1)
          return
        }

        const result = await runTourPhotoUploadQueue({
          files: [file],
          tourId: ctx.tourId,
          uploadedBy: ctx.uploadedBy,
          labels: queueLabels(),
          quiet: true,
        })
        if (result.totalSuccessful > 0) {
          await deletePendingTourPhoto(shotId)
          setShots((prev) =>
            prev.map((shot) => {
              if (shot.id !== shotId) return shot
              return { id: shot.id, previewUrl: shot.previewUrl, status: 'saved', kind: 'photo' }
            })
          )
          setPhotoCount((count) => count + result.totalSuccessful)
          return
        }
        const message = result.failedFiles[0] || result.userMessages?.[0] || t('uploadFailed')
        await persistPending(shotId, file, ctx, message)
        markShotFailed(shotId, file, message, ctx.kind)
      } catch (error) {
        const message = error instanceof Error ? error.message : t('uploadFailed')
        await persistPending(shotId, file, ctx, message)
        markShotFailed(shotId, file, message, ctx.kind)
      }
    },
    [persistPending, queueLabels, t]
  )

  const handleCapturedFile = useCallback(
    async (file: File) => {
      const currentTour = tourRef.current || tour
      if (!currentTour || !currentUserEmail) {
        setTourError(t('noTour'))
        return
      }
      const shotId = crypto.randomUUID()
      const previewUrl = rememberPreview(URL.createObjectURL(file))
      setShots((prev) => [{ id: shotId, previewUrl, status: 'processing', file }, ...prev])
      const classified = await classifyGuideQuickCapture(file)
      const prepared =
        classified.kind === 'receipt' ? file : await prepareGuideQuickPhoto(file)
      setShots((prev) =>
        prev.map((shot) => {
          if (shot.id !== shotId) return shot
          const previewUrl =
            classified.kind !== 'receipt' && prepared !== file
              ? rememberPreview(URL.createObjectURL(prepared))
              : shot.previewUrl
          return {
            ...shot,
            previewUrl,
            file: prepared,
            kind: classified.kind,
            ...(classified.ocrText ? { ocrText: classified.ocrText } : {}),
          }
        })
      )
      await uploadFile(shotId, prepared, {
        tourId: currentTour.id,
        uploadedBy: currentUserEmail,
        kind: classified.kind,
        tourDate: currentTour.tourDate,
        productId: currentTour.productId ?? null,
        ...(classified.ocrText ? { ocrText: classified.ocrText } : {}),
      })
    },
    [currentUserEmail, t, tour, uploadFile]
  )

  const retryShot = useCallback(
    async (shot: LocalShot) => {
      const currentTour = tourRef.current || tour
      if (!currentTour || !currentUserEmail || !shot.file) return
      await uploadFile(shot.id, shot.file, {
        tourId: currentTour.id,
        uploadedBy: currentUserEmail,
        kind: shot.kind || 'photo',
        tourDate: currentTour.tourDate,
        productId: currentTour.productId ?? null,
        ...(shot.ocrText ? { ocrText: shot.ocrText } : {}),
      })
    },
    [currentUserEmail, tour, uploadFile]
  )

  const retryQueued = useCallback(async () => {
    if (!currentUserEmail || isBrowserOffline()) return
    const pending = await listPendingTourPhotos()
    for (const record of pending) {
      const file = new File([record.blob], record.fileName, { type: record.mimeType, lastModified: record.createdAt })
      const kind = record.uploadKind || 'photo'
      setShots((prev) => {
        if (prev.some((shot) => shot.id === record.id)) {
          return prev.map((shot) => (shot.id === record.id ? { ...shot, status: 'uploading', file, kind } : shot))
        }
        const previewUrl = rememberPreview(URL.createObjectURL(record.blob))
        return [{ id: record.id, previewUrl, status: 'uploading', file, kind }, ...prev]
      })
      await uploadFile(record.id, file, {
        tourId: record.tourId,
        uploadedBy: record.uploadedBy || currentUserEmail,
        kind,
        tourDate: record.tourDate || tourRef.current?.tourDate || '',
        productId: record.productId ?? tourRef.current?.productId ?? null,
      })
    }
  }, [currentUserEmail, uploadFile])

  useEffect(() => {
    setOffline(isBrowserOffline())
    const onStatus = () => setOffline(isBrowserOffline())
    window.addEventListener('online', onStatus)
    window.addEventListener('offline', onStatus)
    return () => {
      window.removeEventListener('online', onStatus)
      window.removeEventListener('offline', onStatus)
    }
  }, [])

  useEffect(() => {
    const onOnline = () => {
      void retryQueued()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [retryQueued])

  useEffect(() => {
    if (!currentUserEmail) return
    void loadTour()
  }, [currentUserEmail, loadTour])

  useEffect(() => {
    if (!open) return
    void loadTour()
    void (async () => {
      const pending = await listPendingTourPhotos()
      if (pending.length === 0) return
      setShots((prev) => {
        const existing = new Set(prev.map((shot) => shot.id))
        const extra: LocalShot[] = []
        for (const record of pending) {
          if (existing.has(record.id)) continue
          extra.push({
            id: record.id,
            previewUrl: rememberPreview(URL.createObjectURL(record.blob)),
            status: 'queued',
            file: new File([record.blob], record.fileName, { type: record.mimeType }),
            kind: record.uploadKind || 'photo',
            ...(record.lastError ? { error: record.lastError } : {}),
          })
        }
        return extra.length ? [...extra, ...prev] : prev
      })
    })()
  }, [loadTour, open])

  useEffect(() => {
    tourRef.current = tour
  }, [tour])

  useEffect(() => {
    loadingTourRef.current = loadingTour
  }, [loadingTour])

  const stopLiveCamera = useCallback(() => {
    cameraRequestIdRef.current += 1
    liveCameraOpenRef.current = false
    liveStreamRef.current?.getTracks().forEach((track) => track.stop())
    liveStreamRef.current = null
    setLiveStream(null)
    setLiveCameraOpen(false)
  }, [])

  const takePhoto = useCallback(() => {
    if (!tourRef.current) {
      if (!loadingTourRef.current) setTourError(t('noTour'))
      return false
    }
    if (liveCameraOpenRef.current) return true
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
      return true
    }

    const requestId = cameraRequestIdRef.current + 1
    cameraRequestIdRef.current = requestId
    liveCameraOpenRef.current = true
    setLiveCameraOpen(true)

    void openGuideLiveCameraStream()
      .then((stream) => {
        if (cameraRequestIdRef.current !== requestId) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        liveStreamRef.current = stream
        setLiveStream(stream)
      })
      .catch(() => {
        if (cameraRequestIdRef.current !== requestId) return
        liveCameraOpenRef.current = false
        setLiveCameraOpen(false)
        cameraInputRef.current?.click()
      })

    return true
  }, [t])

  useImperativeHandle(ref, () => ({ openCamera: takePhoto }), [takePhoto])

  useEffect(() => {
    return () => {
      cameraRequestIdRef.current += 1
      liveStreamRef.current?.getTracks().forEach((track) => track.stop())
      liveStreamRef.current = null
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current = []
    }
  }, [])

  const onFilePicked = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target
    const file = target.files?.[0]
    if (file) void handleCapturedFile(file)
    requestAnimationFrame(() => {
      target.value = ''
    })
  }

  const cameraInput = (
    <input
      ref={cameraInputRef}
      type="file"
      accept="image/*,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp"
      capture={isMobileCameraDevice() ? 'environment' : undefined}
      className="hidden"
      onChange={onFilePicked}
    />
  )

  const galleryInput = (
    <input
      ref={galleryInputRef}
      type="file"
      accept="image/*,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp"
      className="hidden"
      onChange={onFilePicked}
    />
  )

  return (
    <>
      {cameraInput}
      {galleryInput}
      <GuideLiveCameraOverlay
        open={liveCameraOpen}
        stream={liveStream}
        lastPreviewUrl={shots[0]?.previewUrl}
        capturedCount={shots.length}
        onClose={stopLiveCamera}
        onCapture={(file) => void handleCapturedFile(file)}
      />
      {open ? (
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4" style={{ zIndex: DIALOG_Z_INDEX.default }}>
        <button type="button" className="absolute inset-0 bg-black/50" aria-label={t('close')} onClick={onClose} />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-quick-photo-title"
          className="relative w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground">{t('todayTour')}</p>
              <h2 id="guide-quick-photo-title" className="text-lg font-semibold tracking-tight text-gray-900">
                {loadingTour ? t('resolving') : tour?.productName || t('todayTour')}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label={t('close')}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
            {offline && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <WifiOff className="h-4 w-4 shrink-0" />
                {t('offlineHint')}
              </p>
            )}

            {tourError && !tour && (
              <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-800">{tourError}</p>
            )}

            <button
              type="button"
              onClick={() => takePhoto()}
              disabled={!tour || loadingTour}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Camera className="h-5 w-5" />
              {t('takePhoto')}
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={!tour || loadingTour}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" />
              {t('chooseFromAlbum')}
            </button>
            <p className="text-center text-xs text-muted-foreground">{isMobileCameraDevice() ? t('cameraHint') : t('desktopHint')}</p>
            <p className="text-center text-xs text-muted-foreground">{t('customerHiddenNote')}</p>

            <p className="text-sm font-medium text-gray-800">
              {t('photosToday', { count: photoCount })}
              {receiptCount > 0 ? ` · ${t('receiptsToday', { count: receiptCount })}` : ''}
            </p>

            <div className="grid grid-cols-3 gap-2">
              {shots.map((shot) => (
                <div key={shot.id} className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shot.previewUrl} alt="" className="h-full w-full object-cover" />
                  {shot.kind === 'receipt' && (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      <Receipt className="h-3 w-3" />
                      {t('receiptBadge')}
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-1 text-center text-[10px] font-medium text-white">
                    {shot.status === 'processing' && t('processing')}
                    {shot.status === 'uploading' && t('uploading')}
                    {shot.status === 'queued' && t('queued')}
                    {shot.status === 'saved' && (
                      <span className="inline-flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {shot.kind === 'receipt' ? t('savedReceipt') : t('saved')}
                      </span>
                    )}
                    {shot.status === 'failed' && t('failed')}
                  </div>
                  {(shot.status === 'processing' || shot.status === 'uploading') && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                  {(shot.status === 'failed' || shot.status === 'queued') && (
                    <button
                      type="button"
                      onClick={() => void retryShot(shot)}
                      className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-gray-900"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {t('retry')}
                    </button>
                  )}
                </div>
              ))}
              {recentPhotos.map((photo) => (
                <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tourPhotoPublicUrl(photo.thumbnailPath || photo.filePath)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      ) : null}
    </>
  )
})

export default GuideQuickPhotoSheet
