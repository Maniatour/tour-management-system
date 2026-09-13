'use client'

import { X } from 'lucide-react'

export type PendingChatImage = {
  id: string
  file: File
  previewUrl: string
}

export default function ChatPendingImagePreview({
  items,
  disabled,
  isKo,
  onRemove,
}: {
  items: PendingChatImage[]
  disabled: boolean
  isKo: boolean
  onRemove: (id: string) => void
}) {
  if (items.length === 0) return null

  return (
    <div className="mb-2">
      <p className="mb-1.5 text-xs text-gray-500">
        {isKo ? '미리보기 · 전송을 누르면 채팅방에 올라갑니다' : 'Preview · Press Send to post'}
      </p>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="group relative h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
          >
            <img
              src={item.previewUrl}
              alt={isKo ? '첨부 이미지 미리보기' : 'Attached image preview'}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-90 transition-opacity hover:bg-black/80 focus:opacity-100 disabled:opacity-50"
              aria-label={isKo ? '이미지 제거' : 'Remove image'}
            >
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
