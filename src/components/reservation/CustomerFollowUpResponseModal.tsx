'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, Loader2, Trash2, Upload, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  CUSTOMER_RESPONSE_IMAGE_TYPES,
  parseCustomerResponseContactContent,
  type CustomerFollowUpResponseSubmitPayload,
  type UploadedCustomerResponseImage,
} from '@/lib/customerFollowUpResponseAssets'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'

type PendingImage = {
  id: string
  file: File
  previewUrl: string
}

type CustomerFollowUpResponseModalProps = {
  isOpen: boolean
  locale: string
  initialValue?: string
  initialCancellationReason?: string
  saving?: boolean
  onClose: () => void
  onSubmit: (payload: CustomerFollowUpResponseSubmitPayload) => void | Promise<void>
}

const LIGHTBOX_Z = DIALOG_Z_INDEX.nestedElevated + 100

function nextPendingId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function CustomerFollowUpResponseModal({
  isOpen,
  locale,
  initialValue = '',
  initialCancellationReason = '',
  saving = false,
  onClose,
  onSubmit,
}: CustomerFollowUpResponseModalProps) {
  const isKo = locale === 'ko'
  const [draft, setDraft] = useState('')
  const [existingImages, setExistingImages] = useState<UploadedCustomerResponseImage[]>([])
  const [cancellationReasonDraft, setCancellationReasonDraft] = useState(initialCancellationReason)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pasteZoneRef = useRef<HTMLDivElement>(null)

  const reasonPresets = isKo
    ? ['No Show', '취소 후 무 응답', '재예약', '미모집', '날씨', '일정 변경', '중복 예약', '가격/정책', '기타']
    : [
        'No Show',
        'No response after cancel',
        'Rebooking',
        'Not recruited',
        'Weather',
        'Schedule conflict',
        'Duplicate booking',
        'Price / Policy',
        'Other',
      ]

  const applyInitialContent = useCallback((value: string, reason: string) => {
    const parsed = parseCustomerResponseContactContent(value)
    setDraft(parsed.text)
    setExistingImages(parsed.images)
    setCancellationReasonDraft(reason)
    setLightboxUrl(null)
    setPendingImages((prev) => {
      for (const img of prev) URL.revokeObjectURL(img.previewUrl)
      return []
    })
  }, [])

  const resetForm = useCallback(() => {
    applyInitialContent(initialValue, initialCancellationReason)
  }, [applyInitialContent, initialCancellationReason, initialValue])

  useEffect(() => {
    if (!isOpen) return
    applyInitialContent(initialValue, initialCancellationReason)
  }, [isOpen, initialCancellationReason, initialValue, applyInitialContent])

  useEffect(() => {
    if (!lightboxUrl) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setLightboxUrl(null)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [lightboxUrl])

  const addImageFile = useCallback((file: File | null) => {
    if (!file) return
    setPendingImages((prev) => [
      ...prev,
      {
        id: nextPendingId(),
        file,
        previewUrl: URL.createObjectURL(file),
      },
    ])
  }, [])

  const removePendingImage = useCallback((id: string) => {
    setPendingImages((prev) => {
      const target = prev.find((img) => img.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((img) => img.id !== id)
    })
  }, [])

  const removeExistingImage = useCallback((imageUrl: string) => {
    setExistingImages((prev) => prev.filter((img) => img.imageUrl !== imageUrl))
  }, [])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        e.stopPropagation()
        addImageFile(file)
        return
      }
    },
    [addImageFile]
  )

  const canSave =
    Boolean(draft.trim()) || pendingImages.length > 0 || existingImages.length > 0

  const expandLabel = isKo ? '크게 보기' : 'View larger'

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          resetForm()
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-base font-semibold">
          {isKo ? '고객 답변 기록' : 'Record customer reply'}
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          {isKo
            ? '문자·이메일·카톡 내용을 붙여넣거나 요약하고, 스크린샷은 아래 영역에 Ctrl+V로 붙여넣거나 파일을 선택하세요.'
            : 'Paste or summarize the reply text. Add screenshots via Ctrl+V in the area below or choose files.'}
        </p>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder={
            isKo
              ? '예: 고객이 일정 변경 불가로 취소 확정, 3월 재방문 시 재예약 의사 있음…'
              : 'e.g. Customer confirmed cancellation due to schedule change…'
          }
        />

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={CUSTOMER_RESPONSE_IMAGE_TYPES.join(',')}
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                for (const file of files) addImageFile(file)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              <Upload className="mr-1.5 h-4 w-4" aria-hidden />
              {isKo ? '이미지 선택' : 'Choose images'}
            </Button>
            <span className="text-xs text-muted-foreground">{isKo ? '또는' : 'or'}</span>
            <div
              ref={pasteZoneRef}
              tabIndex={0}
              onPaste={handlePaste}
              role="button"
              className="inline-flex min-h-9 min-w-[160px] flex-1 items-center rounded-lg border border-dashed border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {isKo ? '여기 클릭 후 Ctrl+V 붙여넣기' : 'Click here, then Ctrl+V to paste'}
            </div>
          </div>

          {existingImages.length > 0 || pendingImages.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {existingImages.map((img) => (
                <li
                  key={img.imageUrl}
                  className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted/40"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(img.imageUrl)}
                    className="h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${expandLabel}: ${img.fileName}`}
                    title={expandLabel}
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.fileName}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExistingImage(img.imageUrl)}
                    disabled={saving}
                    className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    aria-label={isKo ? '이미지 제거' : 'Remove image'}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
              {pendingImages.map((img) => (
                <li
                  key={img.id}
                  className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted/40"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(img.previewUrl)}
                    className="h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${expandLabel}: ${img.file.name}`}
                    title={expandLabel}
                  >
                    <img
                      src={img.previewUrl}
                      alt={img.file.name}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePendingImage(img.id)}
                    disabled={saving}
                    className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    aria-label={isKo ? '이미지 제거' : 'Remove image'}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
              {isKo ? '스크린샷을 붙여넣으면 저장 시 함께 업로드됩니다.' : 'Pasted screenshots will upload when you save.'}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <label className="block text-sm font-medium text-foreground">
            {isKo ? '취소 사유 / 메모' : 'Cancellation reason / notes'}
          </label>
          <p className="text-xs text-muted-foreground">
            {isKo
              ? '고객 답변과 함께 취소 사유를 정리해 두면 follow-up이 완료됩니다.'
              : 'Record the cancel reason with the reply to complete follow-up.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reasonPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCancellationReasonDraft(preset)}
                disabled={saving}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea
            value={cancellationReasonDraft}
            onChange={(e) => setCancellationReasonDraft(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder={
              isKo ? '예: 일정 변경으로 취소, 추후 재예약 의사 있음…' : 'e.g. Cancelled due to schedule change…'
            }
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {isKo ? '닫기' : 'Close'}
          </Button>
          <Button
            type="button"
            onClick={() =>
              void onSubmit({
                text: draft,
                images: pendingImages.map((img) => img.file),
                existingImages,
                cancellationReason: cancellationReasonDraft.trim() || undefined,
              })
            }
            disabled={saving || !canSave}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isKo ? '저장' : 'Save'}
          </Button>
        </div>
      </DialogContent>

      {lightboxUrl && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 flex items-center justify-center bg-black/85 p-4 sm:p-8"
              style={{ zIndex: LIGHTBOX_Z }}
              role="dialog"
              aria-modal="true"
              aria-label={expandLabel}
              onClick={() => setLightboxUrl(null)}
            >
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={isKo ? '닫기' : 'Close'}
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={lightboxUrl}
                alt=""
                className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body
          )
        : null}
    </Dialog>
  )
}
