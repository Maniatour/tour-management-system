'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'
import {
  applyTapToFocus,
  captureGuideLivePhoto,
  enableContinuousAutofocus,
  mapCoverTapToNormalizedPoint,
} from '@/lib/guideLiveCameraFocus'

type GuideLiveCameraOverlayProps = {
  open: boolean
  stream: MediaStream | null
  lastPreviewUrl?: string
  capturedCount: number
  onClose: () => void
  onCapture: (file: File) => void
}

const CAPTURE_GAP_MS = 280

export default function GuideLiveCameraOverlay({
  open,
  stream,
  lastPreviewUrl,
  capturedCount,
  onClose,
  onCapture,
}: GuideLiveCameraOverlayProps) {
  const t = useTranslations('guide.quickPhoto')
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const lastCaptureAtRef = useRef(0)
  const flashTimeoutRef = useRef<number | null>(null)
  const focusAbortRef = useRef<AbortController | null>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [flash, setFlash] = useState(false)
  const [reticle, setReticle] = useState<{ x: number; y: number; token: number } | null>(null)

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current != null) window.clearTimeout(flashTimeoutRef.current)
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
    const track = stream.getVideoTracks()[0]
    if (track) void enableContinuousAutofocus(track)
    return () => {
      video.removeEventListener('loadedmetadata', onReady)
      video.srcObject = null
      setVideoReady(false)
      focusAbortRef.current?.abort()
      setReticle(null)
    }
  }, [open, stream])

  if (!open) return null

  const handleTapToFocus = (event: PointerEvent<HTMLDivElement>) => {
    if (!videoReady || !stream) return
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
    void applyTapToFocus({ track, point, video, signal: controller.signal })

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
    }
  }

  const handleShutter = () => {
    const video = videoRef.current
    if (!video || !videoReady) return
    const now = Date.now()
    if (now - lastCaptureAtRef.current < CAPTURE_GAP_MS) return
    lastCaptureAtRef.current = now
    setFlash(true)
    if (flashTimeoutRef.current != null) window.clearTimeout(flashTimeoutRef.current)
    flashTimeoutRef.current = window.setTimeout(() => setFlash(false), 80)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(30)
    }
    void captureGuideLivePhoto(video, stream).then((file) => {
      if (file) onCapture(file)
    })
  }

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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16">
        <p className="mb-5 text-center text-xs text-white/85">{t('keepShootingHint')}</p>
        <div className="grid grid-cols-3 items-center gap-4">
          <div className="flex justify-start">
            <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/40 bg-white/10">
              {lastPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lastPreviewUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleShutter}
              disabled={!videoReady}
              aria-label={t('shutter')}
              className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/90 shadow-lg transition active:scale-95 disabled:opacity-50"
              style={{ touchAction: 'manipulation' }}
            >
              <span className="h-16 w-16 rounded-full bg-white" />
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
    </div>
  )
}
