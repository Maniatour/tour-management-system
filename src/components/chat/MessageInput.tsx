'use client'

import React, { useState } from 'react'
import { Send, ImageIcon, Smile, MapPin, X } from 'lucide-react'
import type { SupportedLanguage } from '@/lib/translation'
import {
  TOUR_CHAT_IMAGE_ACCEPT,
  filesFromClipboardOrDrop,
} from '@/lib/tourChatImage'

interface MessageInputProps {
  newMessage: string
  setNewMessage: React.Dispatch<React.SetStateAction<string>>
  sending: boolean
  uploading: boolean
  gettingLocation: boolean
  isPublicView: boolean
  selectedLanguage: SupportedLanguage
  roomActive: boolean
  onSendMessage: () => void
  onImageUpload: (files: File[]) => void
  onShareLocation: () => void
  fileInputRef: React.RefObject<HTMLInputElement>
}

export default function MessageInput({
  newMessage,
  setNewMessage,
  sending,
  uploading,
  gettingLocation,
  isPublicView,
  selectedLanguage,
  roomActive,
  onSendMessage,
  onImageUpload,
  onShareLocation,
  fileInputRef
}: MessageInputProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾']

  const busy = sending || uploading || gettingLocation
  const isKo = selectedLanguage === 'ko'

  const handleImageFiles = (files: File[]) => {
    if (busy || files.length === 0) return
    onImageUpload(files)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = filesFromClipboardOrDrop(e.clipboardData)
    if (files.length === 0) return
    e.preventDefault()
    handleImageFiles(files)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (busy) return
    handleImageFiles(filesFromClipboardOrDrop(e.dataTransfer))
  }

  if (!roomActive) return null

  return (
    <div className={`${isPublicView ? 'p-2 lg:p-4' : 'p-2 lg:p-4 border-t bg-white bg-opacity-90 backdrop-blur-sm shadow-lg'} flex-shrink-0 relative`}>
      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault()
          onSendMessage()
        }}
        onPaste={handlePaste}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!busy) setIsDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false)
          }
        }}
        onDrop={handleDrop}
        className={`flex items-center space-x-1 w-full relative rounded-xl ${
          isDragging ? 'ring-2 ring-primary/40 bg-primary/5' : ''
        }`}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-white/80 text-sm font-medium text-primary">
            {isKo ? '이미지를 놓아서 보내기' : 'Drop image to send'}
          </div>
        )}

        {/* 이미지 업로드 버튼 */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={isKo ? '사진·스크린샷 보내기' : 'Send photo or screenshot'}
          aria-label={isKo ? '사진·스크린샷 보내기' : 'Send photo or screenshot'}
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          ) : (
            <ImageIcon size={18} />
          )}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          accept={TOUR_CHAT_IMAGE_ACCEPT}
          multiple
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : []
            if (files.length > 0) {
              handleImageFiles(files)
            }
          }}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />
        
        {/* 이모티콘 버튼 */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
          title={isKo ? '이모티콘' : 'Emoji'}
        >
          <Smile size={18} />
        </button>
        
        {/* 위치 공유 버튼 (고객 및 가이드용) */}
        <button
          type="button"
          onClick={onShareLocation}
          disabled={busy}
          className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={isKo ? '위치 공유' : 'Share Location'}
        >
          {gettingLocation ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          ) : (
            <MapPin size={18} />
          )}
        </button>

        {/* Chrome 결제 autofill 방지: 숨김 decoy + 채팅 전용 textarea */}
        <input
          type="text"
          name="prevent_autofill_username"
          autoComplete="username"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only absolute opacity-0 pointer-events-none h-0 w-0"
          value=""
          readOnly
        />
        <input
          type="password"
          name="prevent_autofill_password"
          autoComplete="new-password"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only absolute opacity-0 pointer-events-none h-0 w-0"
          value=""
          readOnly
        />
        
        <textarea
          id="tour-chat-message-input"
          name="tourChatMessageBody"
          rows={1}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.key === 'Process') return
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSendMessage()
            }
          }}
          placeholder={
            uploading
              ? (isKo ? '이미지 전송 중...' : 'Sending image...')
              : isKo
                ? '메시지 입력, 또는 스크린샷 붙여넣기'
                : 'Type a message, or paste a screenshot'
          }
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm lg:text-base resize-none overflow-hidden max-h-24"
          disabled={busy}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck
          inputMode="text"
          enterKeyHint="send"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
        />
        
        <button
          type="submit"
          disabled={!newMessage.trim() || busy}
          className="flex-shrink-0 px-3 lg:px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 lg:space-x-2 text-sm lg:text-base"
        >
          <Send size={14} className="lg:w-4 lg:h-4" />
          <span className="hidden lg:inline">{sending ? 'Sending...' : 'Send'}</span>
          <span className="lg:hidden">{sending ? '...' : 'Send'}</span>
        </button>
      </form>

      {/* 이모티콘 선택기 */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-2 lg:left-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{isKo ? '이모티콘' : 'Emoji'}</span>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setNewMessage(prev => prev + emoji)
                  setShowEmojiPicker(false)
                }}
                className="p-2 hover:bg-gray-100 rounded text-lg"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
