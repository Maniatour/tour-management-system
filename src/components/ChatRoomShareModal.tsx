'use client'

import { useState } from 'react'
import { X, Copy, Share2, QrCode, MessageCircle, Users, Calendar } from 'lucide-react'

interface ChatRoomShareModalProps {
  isOpen: boolean
  onClose: () => void
  roomCode: string
  roomName: string
  tourDate?: string
}

export default function ChatRoomShareModal({ 
  isOpen, 
  onClose, 
  roomCode, 
  roomName,
  tourDate 
}: ChatRoomShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  if (!isOpen) return null

  const chatUrl = `https://www.kovegas.com/chat/${roomCode}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(chatUrl)}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(chatUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '투어 채팅방',
          text: `${roomName} - 투어 관련 소통을 위한 채팅방입니다.`,
          url: chatUrl
        })
      } catch (error) {
        console.error('Failed to share:', error)
      }
    } else {
      copyLink()
    }
  }

  const shareText = `🗺️ 투어 채팅방에 참여하세요!

📅 투어 날짜: ${tourDate || '확인 필요'}
💬 채팅방: ${roomName}

아래 링크를 클릭하여 가이드와 실시간으로 소통하세요:
${chatUrl}

※ 픽업 시간, 장소, 특이사항 등에 대해 언제든지 문의하실 수 있습니다.`

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <MessageCircle size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">채팅방 공유</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 space-y-6">
          {/* 채팅방 정보 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <MessageCircle size={16} className="text-blue-600" />
              <span className="font-medium text-blue-900">{roomName}</span>
            </div>
            {tourDate && (
              <div className="flex items-center space-x-2 text-sm text-blue-700">
                <Calendar size={14} />
                <span>{new Date(tourDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* 링크 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              채팅방 링크
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={chatUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={copyLink}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {copied ? '복사됨!' : '복사'}
              </button>
            </div>
          </div>

          {/* 공유 방법 */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">공유 방법</h3>
            
            {/* 직접 공유 */}
            <div className="flex space-x-2">
              <button
                onClick={shareLink}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Share2 size={16} />
                <span>공유하기</span>
              </button>
              <button
                onClick={() => setShowQR(!showQR)}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <QrCode size={16} />
              </button>
            </div>

            {/* QR 코드 */}
            {showQR && (
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg border inline-block">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  QR 코드를 스캔하여 채팅방에 접속하세요
                </p>
              </div>
            )}

            {/* 텍스트 공유 */}
            <div>
              <button
                onClick={copyShareText}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Copy size={16} />
                <span>공유 텍스트 복사</span>
              </button>
            </div>
          </div>

          {/* 사용 안내 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">고객 안내사항</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 링크를 클릭하면 채팅방에 접속할 수 있습니다</li>
              <li>• 픽업 시간, 장소 등에 대해 실시간으로 문의하세요</li>
              <li>• 투어 중 특별한 요청사항이 있으면 언제든지 말씀해주세요</li>
              <li>• 가이드가 답변을 드릴 때까지 잠시 기다려주세요</li>
            </ul>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
