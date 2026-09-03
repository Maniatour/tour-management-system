'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { SupportedLanguage } from '@/lib/translation'
import { chatImageDisplayName } from '@/lib/tourChatImage'
import ChatMessageBody from './ChatMessageBody'

const IMAGE_ERROR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='160'%3E%3Crect fill='%23e5e7eb' width='256' height='160'/%3E%3Ctext fill='%236b7280' font-family='sans-serif' font-size='14' x='50%25' y='50%25' text-anchor='middle' dy='5'%3EImage unavailable%3C/text%3E%3C/svg%3E"

interface ChatImageBubbleProps {
  fileUrl: string
  fileName?: string | null | undefined
  caption?: string | null | undefined
  selectedLanguage: SupportedLanguage
  isDarkBubble?: boolean
}

export default function ChatImageBubble({
  fileUrl,
  fileName,
  caption,
  selectedLanguage,
  isDarkBubble = false,
}: ChatImageBubbleProps) {
  const [lightbox, setLightbox] = useState(false)
  const isKo = selectedLanguage === 'ko'
  const alt = fileName || (isKo ? '채팅 이미지' : 'Chat image')
  const displayName = chatImageDisplayName(fileName)
  const trimmedCaption = caption?.trim() || ''

  return (
    <>
      <div className="w-64 max-w-full space-y-2">
        <button
          type="button"
          className="block w-full overflow-hidden rounded-lg bg-black/10 p-0 text-left"
          onClick={() => setLightbox(true)}
          aria-label={isKo ? '이미지 확대' : 'Open image'}
        >
          <img
            src={fileUrl}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full max-h-64 lg:max-h-80 object-contain"
            onError={(e) => {
              const target = e.currentTarget
              if (target.src !== IMAGE_ERROR_PLACEHOLDER) {
                target.src = IMAGE_ERROR_PLACEHOLDER
              }
            }}
          />
        </button>
        {displayName ? (
          <div className={`text-xs break-all ${isDarkBubble ? 'text-white/80' : 'text-gray-500'}`}>
            {displayName}
          </div>
        ) : null}
        {trimmedCaption ? (
          <ChatMessageBody
            message={trimmedCaption}
            selectedLanguage={selectedLanguage}
            isDarkBubble={isDarkBubble}
          />
        ) : null}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            onClick={() => setLightbox(false)}
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X size={20} />
          </button>
          <img
            src={fileUrl}
            alt={alt}
            className="max-h-[90vh] max-w-[min(100%,56rem)] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  )
}
