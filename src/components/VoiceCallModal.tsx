'use client'

import { Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react'
import { CallStatus } from '@/hooks/useVoiceCall'

interface VoiceCallModalProps {
  isOpen: boolean
  callStatus: CallStatus
  callerName?: string
  callDuration: string
  isMuted: boolean
  onAccept?: () => void
  onReject: () => void
  onEnd: () => void
  onToggleMute: () => void
  language?: 'ko' | 'en'
}

export default function VoiceCallModal({
  isOpen,
  callStatus,
  callerName,
  callDuration,
  isMuted,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  language = 'ko'
}: VoiceCallModalProps) {
  if (!isOpen) return null

  const texts = {
    ko: {
      calling: '통화 중...',
      ringing: '통화 요청',
      connected: '통화 중',
      incoming: '들어오는 통화',
      accept: '수락',
      reject: '거절',
      end: '종료',
      mute: '음소거',
      unmute: '음소거 해제'
    },
    en: {
      calling: 'Calling...',
      ringing: 'Incoming Call',
      connected: 'In Call',
      incoming: 'Incoming Call',
      accept: 'Accept',
      reject: 'Reject',
      end: 'End',
      mute: 'Mute',
      unmute: 'Unmute'
    }
  }

  const t = texts[language]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
        {/* 상태 표시 */}
        <div className="text-center mb-6">
          <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
            callStatus === 'connected' 
              ? 'bg-green-100 animate-pulse' 
              : callStatus === 'ringing'
              ? 'bg-blue-100 animate-pulse'
              : 'bg-gray-100'
          }`}>
            <Phone 
              size={40} 
              className={callStatus === 'connected' ? 'text-green-600' : callStatus === 'ringing' ? 'text-blue-600' : 'text-gray-600'}
            />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {callStatus === 'calling' && t.calling}
            {callStatus === 'ringing' && t.ringing}
            {callStatus === 'connected' && t.connected}
          </h2>
          
          {callerName && (
            <p className="text-lg text-gray-600 mb-1">{callerName}</p>
          )}
          
          {callStatus === 'connected' && (
            <p className="text-sm text-gray-500">{callDuration}</p>
          )}
        </div>

        {/* 버튼 영역 */}
        <div className="flex items-center justify-center space-x-4">
          {callStatus === 'ringing' && onAccept && (
            <>
              <button
                onClick={onAccept}
                className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
                title={t.accept}
              >
                <Phone size={24} />
              </button>
              <button
                onClick={onReject}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
                title={t.reject}
              >
                <PhoneOff size={24} />
              </button>
            </>
          )}

          {callStatus === 'calling' && (
            <button
              onClick={onReject}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
              title={t.reject}
            >
              <PhoneOff size={24} />
            </button>
          )}

          {callStatus === 'connected' && (
            <>
              <button
                onClick={onToggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                  isMuted 
                    ? 'bg-red-100 hover:bg-red-200 text-red-600' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
                title={isMuted ? t.unmute : t.mute}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                onClick={onEnd}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
                title={t.end}
              >
                <PhoneOff size={24} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

