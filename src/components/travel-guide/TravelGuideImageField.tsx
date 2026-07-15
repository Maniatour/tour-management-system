'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ClipboardPaste, Expand, Loader2, Upload, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'
import { uploadTravelGuideImage } from '@/lib/uploadTravelGuideImage'
import { cn } from '@/lib/utils'

type Props = {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  uploadLabel: string
  urlPlaceholder: string
  pasteHint: string
  emptyLabel: string
  expandLabel?: string
  className?: string
}

const LIGHTBOX_Z = DIALOG_Z_INDEX.nestedElevated + 100

export default function TravelGuideImageField({
  id,
  label,
  value,
  onChange,
  uploadLabel,
  urlPlaceholder,
  pasteHint,
  emptyLabel,
  expandLabel = 'Click to view fullscreen',
  className,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return

      setUploading(true)
      try {
        const url = await uploadTravelGuideImage(file)
        onChange(url)
      } catch (error) {
        alert(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.')
      } finally {
        setUploading(false)
      }
    },
    [onChange]
  )

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        event.preventDefault()
        const file = item.getAsFile()
        if (file) void uploadFile(file)
        break
      }
    },
    [uploadFile]
  )

  useEffect(() => {
    if (!lightboxOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      setLightboxOpen(false)
    }

    window.addEventListener('keydown', onKeyDown, true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [lightboxOpen])

  return (
    <div
      className={cn(
        'kv-travel-guide-image-field flex h-full flex-col space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      tabIndex={0}
      onPaste={handlePaste}
      aria-labelledby={id}
    >
      <Label id={id} htmlFor={`${id}-url`}>
        {label}
      </Label>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ClipboardPaste className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {pasteHint}
      </p>

      {value ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group relative aspect-[4/3] w-full max-h-56 overflow-hidden rounded-lg border border-border/60 bg-muted text-left transition-shadow hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={expandLabel}
          title={expandLabel}
        >
          <Image src={value} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 360px" unoptimized />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Expand className="h-3.5 w-3.5" aria-hidden />
              {expandLabel}
            </span>
          </span>
        </button>
      ) : (
        <div className="flex aspect-[4/3] w-full max-h-56 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background px-3 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <label className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted/60">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploadLabel}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void uploadFile(file)
              event.target.value = ''
            }}
          />
        </label>
        <Input
          id={`${id}-url`}
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={urlPlaceholder}
          className="w-full"
        />
      </div>

      {lightboxOpen && value
        ? createPortal(
            <div
              className="fixed inset-0 flex items-center justify-center bg-black/90 p-4 sm:p-8"
              style={{ zIndex: LIGHTBOX_Z }}
              role="dialog"
              aria-modal="true"
              aria-label={expandLabel}
              onClick={() => setLightboxOpen(false)}
            >
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <div
                className="relative h-full w-full max-h-[min(92vh,900px)] max-w-[min(96vw,1200px)]"
                onClick={(event) => event.stopPropagation()}
              >
                <Image
                  src={value}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="100vw"
                  unoptimized
                  priority
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
