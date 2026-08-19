'use client'

import Image from 'next/image'
import { Play } from 'lucide-react'
import { isTourMediaVideo } from '@/lib/tourPhotoUploadUtils'

function publicTourPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/tour-photos/${path}`
}

export function tourPhotoPublicUrl(path: string): string {
  return publicTourPhotoUrl(path)
}

export function isTourPhotoVideoItem(fileName: string, mimeType?: string | null): boolean {
  return isTourMediaVideo(fileName, mimeType)
}

type ThumbProps = {
  filePath: string
  fileName: string
  thumbnailPath?: string | null
  mimeType?: string | null
  alt: string
  width?: number
  height?: number
  className?: string
  unoptimized?: boolean
}

export function TourPhotoMediaThumb({
  filePath,
  fileName,
  thumbnailPath,
  mimeType,
  alt,
  width = 200,
  height = 200,
  className = 'h-full w-full object-cover',
  unoptimized = false,
}: ThumbProps) {
  const isVideo = isTourMediaVideo(fileName, mimeType)
  const previewPath = thumbnailPath || filePath
  const previewUrl = publicTourPhotoUrl(previewPath)
  const previewIsVideo = isTourMediaVideo(previewPath)

  if (isVideo && previewIsVideo) {
    return (
      <div className="relative h-full w-full bg-black">
        <video
          src={previewUrl}
          className={className}
          muted
          playsInline
          preload="metadata"
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/60 p-2 text-white">
            <Play className="h-5 w-5 fill-white" />
          </span>
        </span>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <Image
        src={previewUrl}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={{ width: 'auto', height: 'auto' }}
        unoptimized={unoptimized}
      />
      {isVideo && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/60 p-2 text-white">
            <Play className="h-5 w-5 fill-white" />
          </span>
        </span>
      )}
    </div>
  )
}

type ViewerProps = {
  filePath: string
  fileName: string
  mimeType?: string | null
  alt: string
  className?: string
}

export function TourPhotoMediaViewer({
  filePath,
  fileName,
  mimeType,
  alt,
  className = 'max-w-full max-h-full object-contain',
}: ViewerProps) {
  const url = publicTourPhotoUrl(filePath)
  if (isTourMediaVideo(fileName, mimeType)) {
    return (
      <video
        src={url}
        className={className}
        controls
        playsInline
        preload="metadata"
      />
    )
  }

  return (
    <Image
      src={url}
      alt={alt}
      width={1200}
      height={800}
      className={className}
      style={{ width: 'auto', height: 'auto' }}
    />
  )
}
