'use client'

import React, { useState } from 'react'
import { Send, ImageIcon, Smile, MapPin, X } from 'lucide-react'
import type { SupportedLanguage } from '@/lib/translation'

interface MessageInputProps {
  newMessage: string
  setNewMessage: (message: string) => void
  sending: boolean
  uploading: boolean
  gettingLocation: boolean
  isPublicView: boolean
  selectedLanguage: SupportedLanguage
  roomActive: boolean
  onSendMessage: () => void
  onImageUpload: (file: File) => void
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSendMessage()
    }
  }

  const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾']

  if (!roomActive) return null

  return (
    <div className={`${isPublicView ? 'p-2 lg:p-4' : 'p-2 lg:p-4 border-t bg-white bg-opacity-90 backdrop-blur-sm shadow-lg'} flex-shrink-0 relative`}>
      <div className="flex items-center space-x-1 w-full">
        {/* 이미지 업로드 버튼 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending}
          className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={selectedLanguage === 'ko' ? '이미지 업로드' : 'Upload Image'}
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
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              onImageUpload(file)
            }
          }}
          className="hidden"
        />
        
        {/* 이모티콘 버튼 */}
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
          title={selectedLanguage === 'ko' ? '이모티콘' : 'Emoji'}
        >
          <Smile size={18} />
        </button>
        
        {/* 위치 공유 버튼 (고객 및 가이드용) */}
        <button
          onClick={onShareLocation}
          disabled={gettingLocation || sending || uploading}
          className="flex-shrink-0 p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={selectedLanguage === 'ko' ? '위치 공유' : 'Share Location'}
        >
          {gettingLocation ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          ) : (
            <MapPin size={18} />
          )}
        </button>
        
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={selectedLanguage === 'ko' ? '메시지를 입력하세요...' : 'Type your message...'}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
          disabled={sending || uploading || gettingLocation}
        />
        
        <button
          onClick={onSendMessage}
          disabled={!newMessage.trim() || sending || uploading}
          className="flex-shrink-0 px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 lg:space-x-2 text-sm lg:text-base"
        >
          <Send size={14} className="lg:w-4 lg:h-4" />
          <span className="hidden lg:inline">{sending ? 'Sending...' : 'Send'}</span>
          <span className="lg:hidden">{sending ? '...' : 'Send'}</span>
        </button>
      </div>

      {/* 이모티콘 선택기 */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-2 lg:left-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{selectedLanguage === 'ko' ? '이모티콘' : 'Emoji'}</span>
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

