'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchImageUploadApi } from '@/lib/uploadClient'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const MAX_PHOTOS = 8

interface TourReportIssuePhotosProps {
  tourId: string
  urls: string[]
  onChange: (urls: string[]) => void
  locale?: string
}

export default function TourReportIssuePhotos({
  tourId,
  urls,
  onChange,
  locale = 'ko',
}: TourReportIssuePhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const getText = (ko: string, en: string) => (locale === 'en' ? en : ko)

  const uploadFiles = async (files: FileList | File[]) => {
    const remaining = MAX_PHOTOS - urls.length
    if (remaining <= 0) {
      toast.error(getText(`사진은 최대 ${MAX_PHOTOS}장입니다.`, `Up to ${MAX_PHOTOS} photos.`))
      return
    }
    const list = Array.from(files).slice(0, remaining)
    if (list.length === 0) return

    setUploading(true)
    const next = [...urls]
    try {
      for (const file of list) {
        const body = new FormData()
        body.append('file', file)
        body.append('folder', `tour-reports/${tourId}`)
        const res = await fetchImageUploadApi(body)
        const json = await res.json()
        if (!res.ok || !json?.success || !json.imageUrl) {
          throw new Error(json?.error || getText('업로드에 실패했습니다.', 'Upload failed.'))
        }
        next.push(String(json.imageUrl))
      }
      onChange(next)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : getText('업로드에 실패했습니다.', 'Upload failed.'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files)
        }}
      />
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((url) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={getText('이슈 사진', 'Issue photo')} className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                onClick={() => onChange(urls.filter((u) => u !== url))}
                aria-label={getText('사진 삭제', 'Remove photo')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className={cn('h-11 w-full gap-2', urls.length >= MAX_PHOTOS && 'opacity-50')}
        disabled={uploading || urls.length >= MAX_PHOTOS}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {uploading
          ? getText('업로드 중…', 'Uploading…')
          : getText('이슈 사진 추가', 'Add issue photo')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {getText(
          `차량 손상, 분실물, 사고 현장 사진을 남길 수 있습니다. 최대 ${MAX_PHOTOS}장.`,
          `Add photos of damage, lost items, or incidents. Up to ${MAX_PHOTOS}.`
        )}
      </p>
    </div>
  )
}
