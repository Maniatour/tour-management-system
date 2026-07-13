'use client'

import { useCallback, useState } from 'react'
import Image from 'next/image'
import { ClipboardPaste, Loader2, Upload } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadTravelGuideImage } from '@/lib/uploadTravelGuideImage'

type Props = {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  uploadLabel: string
  urlPlaceholder: string
  pasteHint: string
  emptyLabel: string
}

export default function TravelGuideImageField({
  id,
  label,
  value,
  onChange,
  uploadLabel,
  urlPlaceholder,
  pasteHint,
  emptyLabel,
}: Props) {
  const [uploading, setUploading] = useState(false)

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

  return (
    <div
      className="kv-travel-guide-image-field space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border/60 bg-muted">
          <Image src={value} alt="" fill className="object-cover" sizes="480px" unoptimized />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-border/60 bg-background text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted/60">
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
          className="min-w-[220px] flex-1"
        />
      </div>
    </div>
  )
}
