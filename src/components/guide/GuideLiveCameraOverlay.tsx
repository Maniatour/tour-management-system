'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'
import {
  applyTapToFocus,
  mapCoverTapToNormalizedPoint,
} from '@/lib/guideLiveCameraFocus'
import {
  applyCameraPreset,
  captureWithCameraPreset,
  readCameraPresetSupport,
  readStoredCameraPreset,
  storeCameraPreset,
  type CameraPreset,
  type CameraPresetSupport,
} from '@/lib/guideLiveCameraPresets'
import {
  readExposureCompensationRange,
  readTorchSupport,
  setCameraTorch,
  setExposureCompensation,
  snapExposureCompensation,
} from '@/lib/guideLiveCameraExtras'
import { nearestPhotoStop, type GuidePhotoStop } from '@/lib/guidePhotoStopCoverage'
import GuideLiveCameraPresetBar from '@/components/guide/GuideLiveCameraPresetBar'
import GuideLiveCameraTools from '@/components/guide/GuideLiveCameraTools'
import GuidePhotoStopStrip from '@/components/guide/GuidePhotoStopStrip'
import GuidePhotoLightbox, { type GuidePhotoLightboxItem } from '@/components/guide/GuidePhotoLightbox'

type EvRange = { min: number; max: number; step: number }

type GuideLiveCameraOverlayProps = {
  open: boolean
  stream: MediaStream | null
  lastPreviewUrl?: string
  previewItems?: GuidePhotoLightboxItem[]
  capturedCount: number
  stops?: GuidePhotoStop[]
  selectedStopId?: string | null
  stopCounts?: Record<string, number>
  onSelectedStopIdChange?: (id: string) => void
  onClose: () => void
  onCapture: (file: File, meta?: { stopId?: string | null }) => void
  onDeletePreview?: (item: GuidePhotoLightboxItem) => void
  deleting?: boolean
}

const CAPTURE_GAP_MS = 280
const BURST_HOLD_MS = 420
const BURST_INTERVAL_MS = 380

export default function GuideLiveCameraOverlay({
  open,
  stream,
  lastPreviewUrl,
  previewItems = [],
  capturedCount,
  stops = [],
  selectedStopId = null,
  stopCounts = {},
  onSelectedStopIdChange,
  onClose,
  onCapture,
  onDeletePreview,
  deleting,
}: GuideLiveCameraOverlayProps) {
  const t = useTranslations('guide.quickPhoto')
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const lastCaptureAtRef = useRef(0)
  const capturingRef = useRef(false)
  const burstHoldRef = useRef(false)
  const burstTimerRef = useRef<number | null>(null)
  const flashTimeoutRef = useRef<number | null>(null)
  const focusAbortRef = useRef<AbortController | null>(null)
  const selectedStopIdRef = useRef(selectedStopId)
  const [videoReady, setVideoReady] = useState(false)
  const [flash, setFlash] = useState(false)
  const [preset, setPreset] = useState<CameraPreset>(readStoredCameraPreset)
  const [support, setSupport] = useState<CameraPresetSupport>({
    hasManualExposure: false,
    hasManualIso: false,
    hasInfinityFocus: false,
  })
  const [capturing, setCapturing] = useState(false)
  const [reticle, setReticle] = useState<{ x: number; y: number; token: number } | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [evRange, setEvRange] = useState<EvRange | null>(null)
  const [evValue, setEvValue] = useState(0)

  selectedStopIdRef.current = selectedStopId

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current != null) window.clearTimeout(flashTimeoutRef.current)
      if (burstTimerRef.current != null) window.clearTimeout(burstTimerRef.current)
      focusAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!reticle) return
    const timeoutId = window.setTimeout(() => setReticle(null), 1100)
    return () => window.clearTimeout(timeoutId)
  }, [reticle])

  useEffect(() => {
    const video = videoRef.current
    if (!open || !video) return
    if (!stream) {
      video.srcObject = null
      setVideoReady(false)
      return
    }

    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    const onReady = () => setVideoReady(true)
    video.addEventListener('loadedmetadata', onReady)
    void video.play().catch(() => {})
    return () => {
      video.removeEventListener('loadedmetadata', onReady)
      video.srcObject = null
      setVideoReady(false)
      focusAbortRef.current?.abort()
      setReticle(null)
    }
  }, [open, stream])

  useEffect(() => {
    if (!open || !stream || !videoReady) return
    const track = stream.getVideoTracks()[0]
    if (!track) return
    let cancelled = false
    void (async () => {
      await applyCameraPreset(track, preset)
      if (cancelled) return
      setSupport(readCameraPresetSupport(track))
      setTorchSupported(readTorchSupport(track))
      const range = readExposureCompensationRange(track)
      setEvRange(range)
      if (range) setEvValue((current) => snapExposureCompensation(current, range))
      if (torchOn) await setCameraTorch(track, true)
      if (range && evValue !== 0) await setExposureCompensation(track, evValue)
    })()
    return () => {
      cancelled = true
    }
  }, [open, stream, videoReady, preset])

  useEffect(() => {
    if (!open || !stream || !videoReady) return
    const track = stream.getVideoTracks()[0]
    if (!track || !torchSupported) return
    void setCameraTorch(track, torchOn)
  }, [open, stream, videoReady, torchOn, torchSupported])

  useEffect(() => {
    if (!open || !stream || !videoReady || !evRange) return
    const track = stream.getVideoTracks()[0]
    if (!track) return
    void setExposureCompensation(track, evValue)
  }, [evRange, evValue, open, stream, videoReady])

  useEffect(() => {
    if (open) return
    setViewerOpen(false)
    setViewerIndex(0)
    burstHoldRef.current = false
    if (burstTimerRef.current != null) window.clearTimeout(burstTimerRef.current)
    const track = stream?.getVideoTracks()[0]
    if (track) void setCameraTorch(track, false)
    setTorchOn(false)
  }, [open, stream])

  useEffect(() => {
    if (!open || stops.length === 0 || selectedStopId) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const match = nearestPhotoStop(stops, position.coords.latitude, position.coords.longitude)
        if (match) onSelectedStopIdChange?.(match.id)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 8_000 }
    )
  }, [onSelectedStopIdChange, open, selectedStopId, stops])

  const fireShutter = () => {
    const video = videoRef.current
    if (!video || !videoReady || capturingRef.current) return
    const now = Date.now()
    if (preset === 'auto' && now - lastCaptureAtRef.current < CAPTURE_GAP_MS) return
    lastCaptureAtRef.current = now
    capturingRef.current = true
    setCapturing(true)
    if (preset === 'auto') {
      setFlash(true)
      if (flashTimeoutRef.current != null) window.clearTimeout(flashTimeoutRef.current)
      flashTimeoutRef.current = window.setTimeout(() => setFlash(false), 80)
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(preset === 'auto' && burstHoldRef.current ? 12 : 30)
    }
    void captureWithCameraPreset(video, stream, preset, support)
      .then((file) => {
        if (file) onCapture(file, { stopId: selectedStopIdRef.current })
      })
      .finally(() => {
        capturingRef.current = false
        setCapturing(false)
      })
  }

  const stopBurst = () => {
    burstHoldRef.current = false
    if (burstTimerRef.current != null) {
      window.clearTimeout(burstTimerRef.current)
      burstTimerRef.current = null
    }
  }

  const onShutterPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!videoReady) return
    event.currentTarget.setPointerCapture(event.pointerId)
    fireShutter()
    if (preset !== 'auto') return
    burstHoldRef.current = true
    burstTimerRef.current = window.setTimeout(() => {
      const tick = () => {
        if (!burstHoldRef.current) return
        fireShutter()
        burstTimerRef.current = window.setTimeout(tick, BURST_INTERVAL_MS)
      }
      tick()
    }, BURST_HOLD_MS)
  }

  if (!open) return null

  const viewerItems =
    previewItems.length > 0
      ? previewItems
      : lastPreviewUrl
        ? [{ id: lastPreviewUrl, src: lastPreviewUrl, alt: t('viewLastPhoto'), kind: 'photo' as const }]
        : []

  const handleTapToFocus = (event: PointerEvent<HTMLDivElement>) => {
    if (!videoReady || !stream || capturing) return
    if (preset === 'stars') return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const overlay = overlayRef.current
    const video = videoRef.current
    if (!overlay || !video) return

    const overlayRect = overlay.getBoundingClientRect()
    setReticle({
      x: event.clientX - overlayRect.left,
      y: event.clientY - overlayRect.top,
      token: Date.now(),
    })

    const point = mapCoverTapToNormalizedPoint(
      { clientX: event.clientX, clientY: event.clientY },
      video.getBoundingClientRect(),
      { width: video.videoWidth, height: video.videoHeight }
    )
    const track = stream.getVideoTracks()[0]
    if (!point || !track) return

    focusAbortRef.current?.abort()
    const controller = new AbortController()
    focusAbortRef.current = controller
    void applyTapToFocus({
      track,
      point,
      video,
      signal: controller.signal,
      preserveExposure: preset !== 'auto',
      skipDistanceSweep: preset !== 'auto',
    })

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
    }
  }

  const supportHint =
    preset === 'stars' ? t('presetStarsHint') : preset === 'night' ? t('presetNightHint') : t('burstHint')
  const captureLabel = preset === 'stars' ? t('presetStarsCapture') : t('presetNightCapture')

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black"
      style={{ zIndex: DIALOG_Z_INDEX.nestedElevated }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-live-camera-title"
    >
      <h2 id="guide-live-camera-title" className="sr-only">
        {t('takePhoto')}
      </h2>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div
        className="absolute inset-0 z-[1]"
        onPointerDown={handleTapToFocus}
        style={{ touchAction: 'manipulation' }}
        aria-label={t('tapToFocus')}
        role="presentation"
      />

      {reticle ? (
        <div
          key={reticle.token}
          className="pointer-events-none absolute z-[4] h-[72px] w-[72px] rounded-sm border-2 border-[#FFB800] shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{
            left: reticle.x,
            top: reticle.y,
            transform: 'translate(-50%, -50%)',
            animation: 'guide-camera-focus 1.1s ease-out forwards',
          }}
        >
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFB800]" />
        </div>
      ) : null}

      <style>{`
        @keyframes guide-camera-focus {
          0% { transform: translate(-50%, -50%) scale(1.28); opacity: 0.55; }
          18% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          72% { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
      `}</style>

      {(!stream || !videoReady) && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-3 bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-sm text-white/90">{t('cameraStarting')}</p>
        </div>
      )}

      {flash ? <div className="pointer-events-none absolute inset-0 z-[3] bg-white/75" /> : null}

      {capturing && preset !== 'auto' ? (
        <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-black/35">
          <Loader2 className="h-8 w-8 animate-spin text-[#FFB800]" />
          <p className="text-sm font-medium text-white">{captureLabel}</p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {capturedCount > 0 ? (
          <span className="rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white">
            {capturedCount}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          aria-label={t('close')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 sm:px-6">
        <GuidePhotoStopStrip
          stops={stops}
          selectedId={selectedStopId}
          counts={stopCounts}
          onSelect={(id) => onSelectedStopIdChange?.(id)}
          missingLabel={t('stopMissing')}
          lowLabel={t('stopLow')}
          variant="camera"
        />
        <GuideLiveCameraTools
          torchSupported={torchSupported}
          torchOn={torchOn}
          onTorchChange={setTorchOn}
          evRange={evRange}
          evValue={evValue}
          onEvChange={setEvValue}
          disabled={!videoReady}
          torchLabel={torchOn ? t('torchOff') : t('torchOn')}
          evLabel={t('exposure')}
        />
        <GuideLiveCameraPresetBar
          preset={preset}
          disabled={!videoReady || (capturing && preset !== 'auto')}
          supportHint={supportHint}
          labels={{ auto: t('presetAuto'), night: t('presetNight'), stars: t('presetStars') }}
          onChange={(next) => {
            setPreset(next)
            storeCameraPreset(next)
            stopBurst()
          }}
        />
        <div className="grid grid-cols-3 items-center gap-4">
          <div className="flex justify-start">
            {lastPreviewUrl ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setViewerIndex(0)
                  setViewerOpen(true)
                }}
                aria-label={t('viewLastPhoto')}
                className="pointer-events-auto relative h-14 w-14 overflow-hidden rounded-xl border border-white/40 bg-white/10 transition active:scale-95"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lastPreviewUrl} alt="" className="h-full w-full object-cover" />
                {capturedCount > 1 ? (
                  <span className="absolute bottom-0.5 right-0.5 rounded-md bg-black/70 px-1 text-[10px] font-semibold text-white">
                    {capturedCount}
                  </span>
                ) : null}
              </button>
            ) : (
              <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/40 bg-white/10" />
            )}
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onPointerDown={onShutterPointerDown}
              onPointerUp={stopBurst}
              onPointerCancel={stopBurst}
              disabled={!videoReady}
              aria-label={t('shutter')}
              className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/90 shadow-lg transition active:scale-95 disabled:opacity-50"
              style={{ touchAction: 'none' }}
            >
              {capturing && preset !== 'auto' ? (
                <Loader2 className="h-8 w-8 animate-spin text-gray-800" />
              ) : (
                <span className="h-16 w-16 rounded-full bg-white" />
              )}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900"
            >
              {t('doneShooting')}
            </button>
          </div>
        </div>
      </div>
      <GuidePhotoLightbox
        open={viewerOpen}
        items={viewerItems}
        index={Math.min(viewerIndex, Math.max(0, viewerItems.length - 1))}
        onClose={() => setViewerOpen(false)}
        onIndexChange={setViewerIndex}
        onDelete={onDeletePreview}
        deleting={Boolean(deleting)}
        closeLabel={t('close')}
        prevLabel={t('previousPhoto')}
        nextLabel={t('nextPhoto')}
        hintLabel={t('zoomHint')}
        rotateLabel={t('rotate')}
        deleteLabel={t('delete')}
        receiptBadge={t('receiptBadge')}
        photoBadge={t('saved')}
      />
    </div>
  )
}
