'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Image as ImageIcon, Trash2, X } from 'lucide-react'

export type EvidenceAttachment = {
  id: string
  file_path: string
  file_name: string | null
  image_url: string | null
  created_at: string
}

interface ReservationEvidenceUploadProps {
  reservationId: string | null | undefined
  /** 컴팩트 모드(모달 내 작은 영역) */
  compact?: boolean
  /** locale for fallback text */
  locale?: string
  /** 미국 거주자·미성년 비거주·패스 보유 등 증빙 필요 시 영역 강조 */
  highlight?: boolean
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

const highlightBoxClass =
  'rounded-lg border-2 border-amber-500 bg-amber-50 shadow-sm ring-2 ring-amber-200/80'

export default function ReservationEvidenceUpload({
  reservationId,
  compact = true,
  locale = 'ko',
  highlight = false,
}: ReservationEvidenceUploadProps) {
  const [list, setList] = useState<EvidenceAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLDivElement>(null)

  const fetchList = useCallback(async () => {
    if (!reservationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reservations/${reservationId}/evidence`)
      if (res.ok) {
        const data = await res.json()
        setList(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Evidence list fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [reservationId])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const uploadFile = useCallback(
    async (file: File) => {
      if (!reservationId) return
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(locale === 'ko' ? 'JPEG, PNG, GIF, WebP 이미지만 가능합니다.' : 'Only JPEG, PNG, GIF, WebP images are allowed.')
        return
      }
      if (file.size > MAX_SIZE) {
        alert(locale === 'ko' ? '파일 크기는 5MB 이하여야 합니다.' : 'File size must be 5MB or less.')
        return
      }
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'reservation-evidence')
        const uploadRes = await fetch('/api/upload/image', { method: 'POST', body: formData })
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}))
          throw new Error(err.error || 'Upload failed')
        }
        const { imageUrl, path, fileName } = await uploadRes.json()
        const addRes = await fetch(`/api/reservations/${reservationId}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl, filePath: path, fileName: fileName || file.name })
        })
        if (!addRes.ok) throw new Error('Failed to save attachment')
        await fetchList()
      } catch (e) {
        console.error('Evidence upload error:', e)
        alert(e instanceof Error ? e.message : (locale === 'ko' ? '업로드에 실패했습니다.' : 'Upload failed.'))
      } finally {
        setUploading(false)
      }
    },
    [reservationId, locale, fetchList]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items || !reservationId) return
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) uploadFile(file)
          break
        }
      }
    },
    [reservationId, uploadFile]
  )

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      if (!reservationId || !confirm(locale === 'ko' ? '이 증거 자료를 삭제할까요?' : 'Delete this attachment?')) return
      try {
        const res = await fetch(`/api/reservations/${reservationId}/evidence/${attachmentId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Delete failed')
        await fetchList()
      } catch (e) {
        console.error('Evidence delete error:', e)
        alert(locale === 'ko' ? '삭제에 실패했습니다.' : 'Delete failed.')
      }
    },
    [reservationId, locale, fetchList]
  )

  if (reservationId == null) {
    return (
      <div
        className={`mt-2 ${highlight ? `${highlightBoxClass} p-3` : ''}`}
        role={highlight ? 'status' : undefined}
        aria-live={highlight ? 'polite' : undefined}
      >
        <p
          className={`text-[10px] sm:text-xs ${highlight ? 'text-amber-950 font-semibold' : 'text-gray-500'}`}
        >
          {locale === 'ko' ? '예약을 저장한 후 증거 사진을 추가할 수 있습니다.' : 'You can add evidence photos after saving the reservation.'}
        </p>
        {highlight && (
          <p className="text-[10px] sm:text-xs text-amber-900 mt-1.5 font-medium">
            {locale === 'ko'
              ? '위 거주·패스 구분에 인원이 있으면 저장 후 반드시 증빙 이미지를 올려 주세요.'
              : 'After saving, please upload proof images for the selected resident / pass categories.'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className={`mt-3 ${highlight ? `${highlightBoxClass} p-3` : 'pt-3 border-t border-gray-100'} ${compact ? 'space-y-2' : 'space-y-3'}`}
      role={highlight ? 'status' : undefined}
      aria-live={highlight ? 'polite' : undefined}
    >
      <p
        className={`text-[10px] sm:text-xs ${highlight ? 'text-amber-950 font-semibold' : 'text-gray-500'}`}
      >
        {locale === 'ko'
          ? '사진/파일 업로드, 화면 캡처 후 복사·붙여넣기 등으로 이미지 추가 (미국 거주자·패스 보유 등 증거 보관)'
          : 'Add images via file upload or paste from clipboard (e.g. US resident / pass proof).'}
      </p>
      {highlight && (
        <p className="text-[10px] sm:text-xs text-amber-900 font-medium -mt-1">
          {locale === 'ko'
            ? '증빙이 필요한 예약입니다. 거주 증명 또는 패스 관련 이미지를 첨부해 주세요.'
            : 'Proof required: please attach residency or pass documentation.'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`inline-flex items-center text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors disabled:opacity-50 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'}`}
        >
          <Upload className="w-3 h-3 mr-1" />
          {uploading ? (locale === 'ko' ? '업로드 중…' : 'Uploading…') : (locale === 'ko' ? '파일 선택' : 'Choose file')}
        </button>
        <span className="text-[10px] text-gray-400">{locale === 'ko' ? '또는' : 'or'}</span>
        <div
          ref={pasteRef}
          tabIndex={0}
          onPaste={handlePaste}
          role="button"
          className="inline-flex items-center px-2 py-1.5 rounded border border-dashed border-gray-300 bg-gray-50/80 text-[10px] sm:text-xs text-gray-600 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-300 min-w-[140px]"
          title={locale === 'ko' ? '클릭한 뒤 Ctrl+V로 붙여넣기' : 'Click then Ctrl+V to paste'}
        >
          {locale === 'ko' ? '여기 클릭 후 Ctrl+V 붙여넣기' : 'Click here, then Ctrl+V to paste'}
        </div>
      </div>
      {loading ? (
        <p className="text-[10px] text-gray-500">{locale === 'ko' ? '목록 로딩 중…' : 'Loading…'}</p>
      ) : list.length > 0 ? (
        <ul className={`flex flex-wrap gap-2 ${compact ? '' : 'mt-2'}`}>
          {list.map((att) => (
            <li
              key={att.id}
              className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
            >
              <div className={`relative ${compact ? 'w-14 h-14' : 'w-20 h-20'}`}>
                {att.image_url ? (
                  <button
                    type="button"
                    onClick={() => setViewingImageUrl(att.image_url)}
                    className="block w-full h-full focus:outline-none focus:ring-0"
                  >
                    <img
                      src={att.image_url}
                      alt={att.file_name || 'Evidence'}
                      className="w-full h-full object-cover cursor-pointer"
                    />
                  </button>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity cursor-pointer"
                  onClick={() => att.image_url && setViewingImageUrl(att.image_url)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      att.image_url && setViewingImageUrl(att.image_url)
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setViewingImageUrl(att.image_url ?? null)
                    }}
                    className="p-1.5 rounded bg-white/90 text-gray-700 hover:bg-white"
                    title={locale === 'ko' ? '크게 보기' : 'View'}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(att.id)
                    }}
                    className="p-1.5 rounded bg-red-500/90 text-white hover:bg-red-600"
                    title={locale === 'ko' ? '삭제' : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 이미지 보기 모달 */}
      {viewingImageUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewingImageUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label={locale === 'ko' ? '이미지 보기' : 'View image'}
        >
          <button
            type="button"
            onClick={() => setViewingImageUrl(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow-md"
            aria-label={locale === 'ko' ? '닫기' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={viewingImageUrl}
            alt=""
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
