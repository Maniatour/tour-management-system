'use client'

import React from 'react'
import { Trash2, User, MapPin } from 'lucide-react'
import type { ChatMessage } from '@/types/chat'
import type { SupportedLanguage } from '@/lib/translation'

interface MessageListProps {
  messages: ChatMessage[]
  isPublicView: boolean
  customerName?: string
  selectedAvatar: string
  selectedLanguage: SupportedLanguage
  translatedMessages: { [key: string]: string }
  needsTranslation: (message: ChatMessage) => boolean
  getLanguageDisplayName: (langCode: SupportedLanguage) => string
  formatTime: (dateString: string) => string
  canDeleteMessage: (message: ChatMessage) => boolean
  deleteMessage: (messageId: string) => void
  messagesEndRef: React.RefObject<HTMLDivElement>
  showParticipantsList: boolean
  isMobileMenuOpen: boolean
}

export default function MessageList({
  messages,
  isPublicView,
  customerName,
  selectedAvatar,
  selectedLanguage,
  translatedMessages,
  needsTranslation,
  getLanguageDisplayName,
  formatTime,
  canDeleteMessage,
  deleteMessage,
  messagesEndRef,
  showParticipantsList,
  isMobileMenuOpen
}: MessageListProps) {
  return (
    <div 
      className={`flex-1 overflow-y-auto p-2 lg:p-4 space-y-2 lg:space-y-3 min-h-0 bg-gradient-to-b from-transparent to-blue-50 bg-opacity-20 ${!isPublicView && showParticipantsList ? 'mr-64' : ''} ${!isMobileMenuOpen ? 'lg:mt-0' : ''}`}
      style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
    >
      {messages.map((message, index) => {
        const needsTrans = needsTranslation(message)
        const hasTranslation = translatedMessages[message.id]
        
        // 아바타 URL 가져오기 (메시지에 저장된 아바타 또는 기본값)
        const avatarUrl = (message as any).sender_avatar || 
          (message.sender_type === 'customer' 
            ? (message.sender_name === (customerName || '고객') ? selectedAvatar : undefined)
            : undefined)
        
        return (
          <div
            key={`${message.id}-${index}`}
            className={`flex items-start space-x-2 ${message.sender_type === 'guide' ? 'justify-end' : 'justify-start'}`}
          >
            {/* 아바타 (고객 메시지일 때만 왼쪽에 표시) */}
            {message.sender_type === 'customer' && (
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={message.sender_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <User size={20} className="text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex flex-col max-w-xs lg:max-w-md">
              {/* 이름 (고객 메시지일 때만) */}
              {message.sender_type === 'customer' && (
                <div className="text-xs font-medium text-gray-700 mb-1 px-1">
                  {message.sender_name}
                </div>
              )}
              
              <div
                className={`px-3 lg:px-4 py-2 rounded-lg border shadow-sm ${
                  message.sender_type === 'system'
                    ? 'bg-gray-200 bg-opacity-80 backdrop-blur-sm text-gray-700 text-center'
                    : message.sender_type === 'guide'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600'
                    : 'bg-white bg-opacity-90 backdrop-blur-sm text-gray-900 border-gray-200'
                }`}
              >
                {message.sender_type === 'guide' && (
                  <div className="text-xs font-medium mb-1 opacity-90">
                    {message.sender_name}
                  </div>
                )}
                
                {/* 메시지 내용 */}
                <div className="text-sm" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
                  {message.message_type === 'image' && message.file_url ? (
                    <div className="mt-2">
                      <img
                        src={message.file_url}
                        alt={message.file_name || 'Uploaded image'}
                        className="max-w-full h-auto rounded-lg cursor-pointer"
                        onClick={() => window.open(message.file_url, '_blank')}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EImage not found%3C/text%3E%3C/svg%3E'
                        }}
                      />
                      {message.file_name && (
                        <div className="text-xs text-gray-500 mt-1">{message.file_name}</div>
                      )}
                    </div>
                  ) : message.message.startsWith('[EN] ') ? (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">번역된 메시지:</div>
                      <div>{message.message.replace('[EN] ', '')}</div>
                    </div>
                  ) : (
                    <div>
                      {/* 원본 메시지 */}
                      <div className="whitespace-pre-wrap break-words">
                        {message.message.split('\n').map((line, idx) => {
                          // Google Maps 링크 감지
                          if (line.includes('Google Maps:') || line.includes('google.com/maps')) {
                            const urlMatch = line.match(/https?:\/\/[^\s]+/)
                            if (urlMatch) {
                              return (
                                <div key={idx} className="my-1">
                                  {line.split(urlMatch[0])[0]}
                                  <a
                                    href={urlMatch[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1 inline-block"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(urlMatch[0], '_blank')
                                    }}
                                  >
                                    <MapPin size={14} />
                                    {selectedLanguage === 'ko' ? 'Google Maps에서 보기' : 'View on Google Maps'}
                                  </a>
                                </div>
                              )
                            }
                          }
                          // Naver Maps 링크 감지
                          if (line.includes('Naver Maps:') || line.includes('map.naver.com')) {
                            const urlMatch = line.match(/https?:\/\/[^\s]+/)
                            if (urlMatch) {
                              return (
                                <div key={idx} className="my-1">
                                  {line.split(urlMatch[0])[0]}
                                  <a
                                    href={urlMatch[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-600 hover:text-green-800 underline flex items-center gap-1 inline-block"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(urlMatch[0], '_blank')
                                    }}
                                  >
                                    <MapPin size={14} />
                                    {selectedLanguage === 'ko' ? 'Naver Maps에서 보기' : 'View on Naver Maps'}
                                  </a>
                                </div>
                              )
                            }
                          }
                          return <div key={idx}>{line}</div>
                        })}
                      </div>
                      
                      {/* 가이드 메시지 자동 번역 (고객용/관리자용) */}
                      {message.sender_type === 'guide' && needsTrans && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          {hasTranslation ? (
                            <div className="text-xs text-white">
                              <span className="font-medium">{getLanguageDisplayName(selectedLanguage)}:</span> {hasTranslation}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">
                              {getLanguageDisplayName(selectedLanguage)}으로 번역 사용 가능
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs opacity-70">
                    {formatTime(message.created_at)}
                  </div>
                  
                  {/* 삭제 버튼 (자신이 보낸 메시지이고 1분 이내) */}
                  {((isPublicView && message.sender_type === 'customer') || 
                    (!isPublicView && message.sender_type === 'guide')) && 
                   canDeleteMessage(message) && (
                    <button
                      onClick={() => {
                        if (confirm('메시지를 삭제하시겠습니까?')) {
                          deleteMessage(message.id)
                        }
                      }}
                      className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="메시지 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <div ref={messagesEndRef} />
    </div>
  )
}

