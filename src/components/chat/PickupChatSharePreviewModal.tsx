'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { PickupChatShareDraft, PickupChatShareKind } from '@/lib/pickupChatShare'

function titleForKind(kind: PickupChatShareKind, isKo: boolean): string {
  if (kind === 'maps') return isKo ? '구글 맵 안내 미리보기' : 'Google Maps preview'
  if (kind === 'images') return isKo ? '픽업 장소 사진 미리보기' : 'Pickup photos preview'
  if (kind === 'inside') return isKo ? '호텔 내부 안내 미리보기' : 'From Inside Hotel preview'
  if (kind === 'outside') return isKo ? '호텔 외부 안내 미리보기' : 'From Outside Hotel preview'
  return isKo ? '위치 설명 미리보기' : 'Location description preview'
}

export default function PickupChatSharePreviewModal({
  draft,
  isKo,
  sending,
  onClose,
  onConfirm,
}: {
  draft: PickupChatShareDraft
  isKo: boolean
  sending: boolean
  onClose: () => void
  onConfirm: (draft: PickupChatShareDraft) => void | Promise<void>
}) {
  const [text, setText] = useState(draft.text)
  const [imageUrls, setImageUrls] = useState(draft.imageUrls)

  useEffect(() => {
    setText(draft.text)
    setImageUrls(draft.imageUrls)
  }, [draft])

  const canSend = text.trim().length > 0 || imageUrls.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {titleForKind(draft.kind, isKo)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {imageUrls.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {imageUrls.map((url) => (
                <li
                  key={url}
                  className="group relative h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                >
                  <img
                    src={url}
                    alt={isKo ? '픽업 장소 사진' : 'Pickup location photo'}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrls((prev) => prev.filter((item) => item !== url))}
                    disabled={sending}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 disabled:opacity-50"
                    aria-label={isKo ? '사진 제거' : 'Remove photo'}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="block text-xs font-medium text-gray-600">
            {isKo ? '채팅에 보낼 메시지' : 'Message to send'}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={imageUrls.length > 0 ? 3 : 8}
              disabled={sending}
              className="mt-1.5 w-full resize-y rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <p className="text-xs text-gray-500">
            {isKo
              ? '내용을 확인한 뒤 전송을 누르면 채팅방에 올라갑니다.'
              : 'Review the message, then press Send to post it in the chat.'}
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 disabled:opacity-50"
          >
            {isKo ? '취소' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={sending || !canSend}
            onClick={() => {
              void onConfirm({
                ...draft,
                text: text.trim(),
                imageUrls,
              })
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (isKo ? '전송 중...' : 'Sending...') : (isKo ? '채팅으로 전송' : 'Send to chat')}
          </button>
        </div>
      </div>
    </div>
  )
}
