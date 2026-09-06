'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, VolumeX, GripVertical, X, Download, Loader2 } from 'lucide-react'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import ReactCountryFlag from 'react-country-flag'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { getGuideMedia } from '@/lib/guideOfflineStore'

function downloadFileName(title: string, fileName?: string, filePath?: string): string {
  const fromPath = filePath?.split('/').pop()?.trim()
  const raw = (fileName || fromPath || `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'narration'}.mp3`).trim()
  return raw || 'narration.mp3'
}

export default function GlobalAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    pauseTrack,
    resumeTrack,
    stopTrack,
    seekTo,
    setVolume,
    toggleMute,
    skipBackward,
    skipForward,
    resetToStart
  } = useAudioPlayer()
  const locale = useLocale()

  const [customPos, setCustomPos] = useState<{ left: number; bottom: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, left: 0, bottom: 0 })
  const [downloading, setDownloading] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!currentTrack) {
      setCustomPos(null)
    }
  }, [currentTrack])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return

      const el = playerRef.current
      const width = el?.offsetWidth || 400
      const height = el?.offsetHeight || 100
      const maxLeft = Math.max(8, window.innerWidth - width - 8)
      const maxBottom = Math.max(8, window.innerHeight - height - 8)
      const nextLeft = dragStart.left + (e.clientX - dragStart.x)
      const nextBottom = dragStart.bottom - (e.clientY - dragStart.y)

      setCustomPos({
        left: Math.max(8, Math.min(maxLeft, nextLeft)),
        bottom: Math.max(8, Math.min(maxBottom, nextBottom)),
      })
    }

    const handlePointerUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, dragStart])

  const handleDragStart = (e: React.PointerEvent) => {
    if (!e.target || !(e.target as HTMLElement).closest('.drag-handle')) {
      return
    }

    const el = playerRef.current
    if (!el) return

    e.preventDefault()
    const rect = el.getBoundingClientRect()
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      left: rect.left,
      bottom: window.innerHeight - rect.bottom,
    })
    setCustomPos({
      left: rect.left,
      bottom: window.innerHeight - rect.bottom,
    })
  }

  if (!currentTrack) {
    return null
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getLanguageFlag = (language: string | null | undefined) => {
    const raw = (language || '').trim().toLowerCase()
    if (raw.startsWith('en')) return 'US'
    if (raw.startsWith('ja')) return 'JP'
    if (raw.startsWith('zh') || raw === 'cn') return 'CN'
    if (raw.startsWith('ko') || raw === 'kr' || !raw) return 'KR'
    return 'US'
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0
  const downloadLabel = locale === 'en' ? 'Download' : '다운로드'
  const downloadErrorLabel = locale === 'en' ? 'Could not download this file.' : '파일을 다운로드하지 못했습니다.'
  const closeLabel = locale === 'en' ? 'Close' : '닫기'

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      let blob: Blob | null = null
      if (currentTrack.filePath) {
        const cached = await getGuideMedia(currentTrack.filePath)
        if (cached?.blob) blob = cached.blob
      }
      if (!blob) {
        const response = await fetch(currentTrack.src)
        if (!response.ok) throw new Error('download_failed')
        blob = await response.blob()
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = downloadFileName(currentTrack.title, currentTrack.fileName, currentTrack.filePath)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('narration download failed', error)
      toast.error(downloadErrorLabel)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      ref={playerRef}
      className={`fixed z-[60] w-[min(22.5rem,calc(100vw-1.5rem))] rounded-2xl border border-gray-200 bg-white shadow-lg select-none ${
        customPos
          ? ''
          : 'left-1/2 -translate-x-1/2 bottom-[calc(var(--footer-height)+env(safe-area-inset-bottom,0px)+0.75rem)] lg:bottom-6'
      }`}
      style={customPos ? { left: customPos.left, bottom: customPos.bottom } : undefined}
    >
      <div className="px-3 py-2">
        <div
          className="drag-handle mb-1 flex cursor-move items-center justify-center rounded-t-lg border-b border-gray-100 pb-1 hover:bg-gray-50"
          onPointerDown={handleDragStart}
        >
          <GripVertical className="h-3 w-3 text-gray-400" />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center space-x-2">
            <h3 className="truncate text-sm font-medium text-gray-900">
              {currentTrack.title}
            </h3>
            <ReactCountryFlag
              countryCode={getLanguageFlag(currentTrack.language)}
              svg
              style={{
                width: '16px',
                height: '12px',
                borderRadius: '2px'
              }}
            />
          </div>
          <div className="ml-2 flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              className="flex h-9 w-9 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              title={downloadLabel}
              aria-label={downloadLabel}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={stopTrack}
              className="flex h-9 w-9 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title={closeLabel}
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <button
              onClick={resetToStart}
              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              title="처음으로"
            >
              <RotateCcw size={14} />
            </button>

            <button
              onClick={skipBackward}
              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              title="10초 뒤로"
            >
              <SkipBack size={14} />
            </button>

            <button
              onClick={isPlaying ? pauseTrack : resumeTrack}
              className="rounded-full bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90"
              title={isPlaying ? '일시정지' : '재생'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <button
              onClick={skipForward}
              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              title="10초 앞으로"
            >
              <SkipForward size={14} />
            </button>
          </div>

          <div className="text-xs text-gray-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={toggleMute}
              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="slider h-1 w-16 cursor-pointer appearance-none rounded-lg bg-gray-200"
              title="볼륨 조절"
            />
          </div>
        </div>

        <div className="mt-1">
          <div className="h-1 w-full cursor-pointer rounded-full bg-gray-200" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const clickX = e.clientX - rect.left
            const percentage = clickX / rect.width
            const newTime = percentage * duration
            seekTo(newTime)
          }}>
            <div
              className="h-1 rounded-full bg-blue-600 transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
