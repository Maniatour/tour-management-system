'use client'

import React, { useState, useEffect } from 'react'
import { X, Mail, Eye, Loader2, Send } from 'lucide-react'

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  emailType: 'confirmation' | 'departure' | 'pickup'
  customerEmail: string
  pickupTime?: string | null
  tourDate?: string | null
  onSend: () => Promise<void>
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  reservationId,
  emailType,
  customerEmail,
  pickupTime,
  tourDate,
  onSend
}: EmailPreviewModalProps) {
  const [emailContent, setEmailContent] = useState<{
    subject: string
    html: string
    customer: {
      name: string
      email: string
      language: string
    }
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  // 이메일 미리보기 로드
  useEffect(() => {
    if (!isOpen || !reservationId) return

    const loadEmailPreview = async () => {
      setLoading(true)
      try {
        let response: Response

        if (emailType === 'pickup') {
          if (!pickupTime || !tourDate) {
            alert('픽업 시간과 투어 날짜가 필요합니다.')
            setLoading(false)
            return
          }

          response = await fetch('/api/preview-pickup-schedule-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reservationId,
              pickupTime: pickupTime.includes(':') 
                ? pickupTime 
                : `${pickupTime}:00`,
              tourDate
            })
          })
        } else {
          // 예약 확인 이메일 또는 투어 출발 확정 이메일
          const type = emailType === 'confirmation' ? 'both' : 'voucher'
          response = await fetch('/api/preview-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reservationId,
              type
            })
          })
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `이메일 미리보기 로드 실패 (${response.status})`)
        }

        const data = await response.json()
        if (!data.emailContent) {
          throw new Error('이메일 내용을 받을 수 없습니다.')
        }
        setEmailContent(data.emailContent)
      } catch (error) {
        console.error('이메일 미리보기 로드 오류:', error)
        alert('이메일 미리보기를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadEmailPreview()
  }, [isOpen, reservationId, emailType, pickupTime, tourDate])

  const handleSend = async () => {
    setSending(true)
    try {
      await onSend()
      onClose()
    } catch (error) {
      console.error('이메일 발송 오류:', error)
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  const emailTypeLabels = {
    confirmation: '예약 확인 이메일',
    departure: '투어 출발 확정 이메일',
    pickup: '픽업 notification 이메일'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">{emailTypeLabels[emailType]} 미리보기</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">이메일 미리보기를 불러오는 중...</p>
              </div>
            </div>
          ) : emailContent ? (
            <div className="space-y-4">
              {/* 이메일 정보 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">받는 사람:</span>
                    <span className="ml-2 text-gray-900">{emailContent.customer?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">이메일:</span>
                    <span className="ml-2 text-gray-900">{emailContent.customer?.email || customerEmail}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">언어:</span>
                    <span className="ml-2 text-gray-900">{emailContent.customer?.language || '한국어'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">제목:</span>
                    <span className="ml-2 text-gray-900">{emailContent.subject || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* 이메일 내용 미리보기 */}
              <div className="border rounded-lg overflow-hidden bg-white">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>이메일 미리보기</span>
                  </div>
                </div>
                <div 
                  className="p-4"
                  dangerouslySetInnerHTML={{ __html: emailContent.html }}
                  style={{ 
                    maxWidth: '600px',
                    margin: '0 auto'
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>이메일 미리보기를 불러올 수 없습니다.</p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            닫기
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !emailContent}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>발송 중...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>이메일 발송</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}


