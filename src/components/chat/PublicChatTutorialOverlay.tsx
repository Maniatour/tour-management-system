'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { SupportedLanguage } from '@/lib/translation'

interface PublicChatTutorialOverlayProps {
  open: boolean
  language: SupportedLanguage
  onClose: () => void
  onComplete: () => void
}

export default function PublicChatTutorialOverlay({
  open,
  language,
  onClose,
  onComplete
}: PublicChatTutorialOverlayProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null

  const isKo = language === 'ko'

  const steps: { title: string; body: string[] }[] = isKo
    ? [
        {
          title: '투어 채팅방에 오신 것을 환영합니다',
          body: [
            '이 페이지에서 가이드·스태프와 실시간으로 메시지를 주고받을 수 있습니다.',
            '아래 단계에서 주요 버튼 설명을 확인한 뒤 채팅을 시작해 주세요.'
          ]
        },
        {
          title: '맨 위 바 (페이지 헤더)',
          body: [
            '다운로드: 휴대폰에 이 채팅을 앱처럼 홈 화면에 추가할 수 있습니다.',
            '종 모양: 새 메시지 알림을 받을지 켜거나 끕니다 (브라우저에서 허용이 필요할 수 있음).',
            '국기: 한국어 ↔ English 표시 언어를 바꿉니다.',
            '메뉴(모바일): 채팅 상단의 도구 줄을 접거나 펼칩니다.'
          ]
        },
        {
          title: '채팅 상단 도구',
          body: [
            '확성기: 공지사항을 봅니다.',
            '달력: 픽업 일정·장소를 확인합니다.',
            '사진: 투어 관련 사진 갤러리를 엽니다.',
            '사람 여러 명: 가이드·팀 정보를 봅니다.',
            '전화: 가이드와 음성 통화를 시도합니다 (가이드가 받을 수 있을 때).',
            '복사 / 공유: 이 채팅방 링크를 복사하거나 다른 앱으로 공유합니다.',
            '숫자 뱃지: 지금까지 올라온 메시지 개수입니다.'
          ]
        },
        {
          title: '대화 목록',
          body: [
            '가이드와 주고받은 메시지가 시간 순으로 표시됩니다.',
            '위로 스크롤하면 이전 대화를 볼 수 있습니다.'
          ]
        },
        {
          title: '메시지 입력줄',
          body: [
            '사진 아이콘: 이미지를 올려 보냅니다.',
            '웃는 얼굴: 이모지를 넣습니다.',
            '위치 핀: 현재 위치를 지도로 공유합니다.',
            '입력창에 글을 쓰고 전송(또는 Enter)으로 보냅니다.'
          ]
        }
      ]
    : [
        {
          title: 'Welcome to your tour chat',
          body: [
            'Use this page to message your guide and staff in real time.',
            'The next steps explain what each button does.'
          ]
        },
        {
          title: 'Top bar (page header)',
          body: [
            'Download: Add this chat to your home screen like an app.',
            'Bell: Turn push notifications on or off (your browser may ask for permission).',
            'Flag: Switch between Korean and English.',
            'Menu (mobile): Expand or collapse the chat toolbar.'
          ]
        },
        {
          title: 'Chat toolbar',
          body: [
            'Megaphone: Open announcements.',
            'Calendar: Pickup schedule and details.',
            'Image: Tour photo gallery.',
            'People: Guide and team info.',
            'Phone: Start a voice call when your guide is available.',
            'Copy / Share: Copy or share this chat link.',
            'Number badge: Total messages in this room.'
          ]
        },
        {
          title: 'Message list',
          body: [
            'Messages appear in chronological order.',
            'Scroll up to read older messages.'
          ]
        },
        {
          title: 'Message input',
          body: [
            'Image: Send a photo.',
            'Smile: Insert emoji.',
            'Map pin: Share your current location on a map.',
            'Type in the box and tap Send (or press Enter).'
          ]
        }
      ]

  const last = steps.length - 1
  const current = steps[step]

  const handleFinish = () => {
    onComplete()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-chat-tutorial-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <p className="text-xs font-medium text-blue-800 tabular-nums">
            {isKo ? '안내' : 'Guide'} {step + 1}/{steps.length}
          </p>
          <button
            type="button"
            onClick={handleFinish}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-4 overflow-y-auto flex-1">
          <h2 id="public-chat-tutorial-title" className="text-lg font-semibold text-gray-900 mb-3">
            {current.title}
          </h2>
          <ul className="space-y-2.5 text-sm text-gray-700 leading-relaxed">
            {current.body.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-500 flex-shrink-0 mt-0.5">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-gray-50">
          <button
            type="button"
            onClick={handleFinish}
            className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-200/80"
          >
            {isKo ? '건너뛰기' : 'Skip'}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
              >
                <ChevronLeft size={16} />
                {isKo ? '이전' : 'Back'}
              </button>
            )}
            {step < last ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(last, s + 1))}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                {isKo ? '다음' : 'Next'}
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                {isKo ? '시작하기' : 'Got it'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
