'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'

type GuideLiveCameraOverlayProps = {
  open: boolean
  stream: MediaStream | null
  lastPreviewUrl?: string
  capturedCount: number
  onClose: () => void
  onCapture: (file: File) => void
}

const CAPTURE_GAP_MS = 280

function captureVideoFrame(video: HTMLVideoElement, quality = 0.92): Promise<File | null> {
  if (video.videoWidth < 1 || video.videoHeight < 1) return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.drawImage(video, 0, 0)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        resolve(
          new File([blob], `tour-photo-${Date.now()}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
        )
      },
      'image/jpeg',
      quality
    )
  })
}

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
  const lastCaptureAtRef = useRef(0)
  const flashTimeoutRef = useRef<number | null>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current != null) window.clearTimeout(flashTimeoutRef.current)
    }
  }, [])

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
    }
  }, [open, stream])

  if (!open) return null

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
    void captureVideoFrame(video).then((file) => {
      if (file) onCapture(file)
    })
  }

  return (
    <div
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

      {(!stream || !videoReady) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-sm text-white/90">{t('cameraStarting')}</p>
        </div>
      )}

      {flash ? <div className="pointer-events-none absolute inset-0 bg-white/75" /> : null}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
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
          className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          aria-label={t('close')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16">
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
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/90 shadow-lg transition active:scale-95 disabled:opacity-50"
              style={{ touchAction: 'manipulation' }}
            >
              <span className="h-16 w-16 rounded-full bg-white" />
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900"
            >
              {t('doneShooting')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
