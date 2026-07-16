'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ImageIcon,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { PickupHotel } from '@/utils/pickupHotelUtils'

interface PickupHotelMediaEditModalProps {
  hotel: PickupHotel
  locale?: 'ko' | 'en'
  initialIndex?: number
  onClose: () => void
  onSave: (
    hotelId: string,
    patch: { media: string[] | null; map_image: string | null }
  ) => Promise<void>
}

const convertGoogleDriveUrl = (url: string): string => {
  const trimmed = url.trim()
  if (!trimmed.includes('drive.google.com/file/d/')) return trimmed
  const fileId = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
  return fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : trimmed
}

const inputClass =
  'h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'

async function uploadFile(file: File): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('pickup-hotel-media').upload(fileName, file)
  if (error) throw error
  const { data } = supabase.storage.from('pickup-hotel-media').getPublicUrl(fileName)
  return data.publicUrl
}

export default function PickupHotelMediaEditModal({
  hotel,
  locale = 'ko',
  initialIndex = 0,
  onClose,
  onSave,
}: PickupHotelMediaEditModalProps) {
  const isEn = locale === 'en'
  const [media, setMedia] = useState<string[]>(() =>
    (hotel.media || []).map((u) => u || '').filter((u, i) => u || i === 0)
  )
  const [mapImage, setMapImage] = useState(hotel.map_image || '')
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, Math.min(initialIndex, Math.max((hotel.media || []).length - 1, 0)))
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mapFileInputRef = useRef<HTMLInputElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const next = [...(hotel.media || [])]
    setMedia(next.length > 0 ? next : [''])
    setMapImage(hotel.map_image || '')
    setSelectedIndex(Math.max(0, Math.min(initialIndex, Math.max(next.length - 1, 0))))
    setError(null)
  }, [hotel, initialIndex])

  const selectedUrl = media[selectedIndex] || ''

  const updateUrlAt = (index: number, value: string) => {
    setMedia((prev) => {
      const next = [...prev]
      while (next.length <= index) next.push('')
      next[index] = value
      return next
    })
  }

  const removeAt = (index: number) => {
    setMedia((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : ['']
    })
    setSelectedIndex((prev) => {
      if (index < prev) return prev - 1
      if (index === prev) return Math.max(0, prev - 1)
      return prev
    })
  }

  const moveToMain = (index: number) => {
    if (index <= 0) return
    setMedia((prev) => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.unshift(item)
      return next
    })
    setSelectedIndex(0)
  }

  const addBlank = () => {
    setMedia((prev) => [...prev, ''])
    setSelectedIndex(media.length)
  }

  const handleUploadReplace = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadFile(file)
      updateUrlAt(selectedIndex, url)
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? 'Upload failed' : '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const handleUploadAdd = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadFile(file)
      setMedia((prev) => {
        const cleaned = prev.filter((u) => u.trim())
        const next = [...cleaned, url]
        setSelectedIndex(next.length - 1)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? 'Upload failed' : '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const handleUploadMap = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadFile(file)
      setMapImage(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? 'Upload failed' : '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const cleaned = media.map(convertGoogleDriveUrl).map((u) => u.trim()).filter(Boolean)
      await onSave(hotel.id, {
        media: cleaned.length > 0 ? cleaned : null,
        map_image: convertGoogleDriveUrl(mapImage).trim() || null,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? 'Save failed' : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10020] flex items-start justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm">
      <div className="relative my-[calc(var(--header-height,4rem)+0.75rem)] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              {isEn ? 'Manage Images' : '이미지 관리'}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{hotel.hotel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[min(72vh,640px)] space-y-4 overflow-y-auto px-4 py-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Preview */}
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-muted">
            {selectedUrl.trim() ? (
              <Image
                src={convertGoogleDriveUrl(selectedUrl)}
                alt={`${hotel.hotel} ${selectedIndex + 1}`}
                fill
                unoptimized
                className="object-contain bg-slate-950"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon size={28} />
                <span className="text-xs">{isEn ? 'No image selected' : '선택된 이미지 없음'}</span>
              </div>
            )}
            {selectedIndex === 0 && selectedUrl.trim() && (
              <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                {isEn ? 'Main' : '대표'}
              </span>
            )}
          </div>

          {/* Selected item controls */}
          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">
                {isEn ? `Image ${selectedIndex + 1}` : `이미지 ${selectedIndex + 1}`}
                {selectedIndex === 0 ? (isEn ? ' (Main)' : ' (대표)') : ''}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => moveToMain(selectedIndex)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    <Star size={13} />
                    {isEn ? 'Set as main' : '대표로'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {isEn ? 'Replace' : '교체 업로드'}
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(selectedIndex)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={13} />
                  {isEn ? 'Delete' : '삭제'}
                </button>
              </div>
            </div>
            <input
              className={inputClass}
              value={selectedUrl}
              onChange={(e) => updateUrlAt(selectedIndex, e.target.value)}
              placeholder={isEn ? 'Image URL or Google Drive link' : '이미지 URL 또는 Google Drive 링크'}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUploadReplace(e.target.files?.[0] || null)}
            />
          </div>

          {/* Thumbnails */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-foreground">
                {isEn ? 'Gallery' : '갤러리'}
              </h4>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => addFileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <Upload size={13} />
                  {isEn ? 'Upload' : '업로드 추가'}
                </button>
                <button
                  type="button"
                  onClick={addBlank}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-dashed border-border bg-white px-2.5 text-xs font-medium hover:bg-muted"
                >
                  <Plus size={13} />
                  {isEn ? 'Add URL' : 'URL 추가'}
                </button>
              </div>
              <input
                ref={addFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleUploadAdd(e.target.files?.[0] || null)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {media.map((url, index) => (
                <button
                  key={`${index}-${url.slice(0, 24)}`}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-muted ${
                    index === selectedIndex ? 'border-primary' : 'border-transparent hover:border-border'
                  }`}
                >
                  {url.trim() ? (
                    <Image
                      src={convertGoogleDriveUrl(url)}
                      alt={`thumb ${index + 1}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageIcon size={18} />
                    </div>
                  )}
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-primary/90 px-1 text-[9px] font-bold text-white">
                      {isEn ? 'Main' : '대표'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Map image */}
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-foreground">
                {isEn ? 'Map image (optional)' : '지도 이미지 (선택)'}
              </h4>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => mapFileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <Upload size={13} />
                  {isEn ? 'Upload' : '업로드'}
                </button>
                {mapImage.trim() && (
                  <button
                    type="button"
                    onClick={() => setMapImage('')}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                    {isEn ? 'Delete' : '삭제'}
                  </button>
                )}
              </div>
            </div>
            <div className="mb-2 grid gap-2 sm:grid-cols-[140px_1fr]">
              <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted sm:aspect-square">
                {mapImage.trim() ? (
                  <Image
                    src={convertGoogleDriveUrl(mapImage)}
                    alt="map"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageIcon size={18} />
                  </div>
                )}
              </div>
              <input
                className={inputClass}
                value={mapImage}
                onChange={(e) => setMapImage(e.target.value)}
                placeholder={isEn ? 'Map screenshot URL' : '지도 스크린샷 URL'}
              />
            </div>
            <input
              ref={mapFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUploadMap(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading}
            className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {isEn ? 'Cancel' : '취소'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || uploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {(saving || uploading) && <Loader2 size={14} className="animate-spin" />}
            {isEn ? 'Save' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
