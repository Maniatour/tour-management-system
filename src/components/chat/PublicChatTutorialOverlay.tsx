'use client'

import { useState, useEffect, type ReactNode } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Bell,
  BellOff,
  Menu,
  Megaphone,
  Calendar,
  ImageIcon,
  Users,
  Phone,
  Copy,
  Share2,
  ChevronDown,
  Send,
  Smile,
  MapPin,
  MessageSquare,
  BookOpen
} from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import type { SupportedLanguage } from '@/lib/translation'

interface PublicChatTutorialOverlayProps {
  open: boolean
  language: SupportedLanguage
  onClose: () => void
  onComplete: () => void
}

/** 채팅 헤더의 컬러 툴바 버튼과 동일 (고객용 모바일 접힘 행 기준) */
function ToolbarIconDemo({
  className,
  children
}: {
  className: string
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex p-2 rounded border items-center justify-center ${className}`}
      aria-hidden
    >
      {children}
    </span>
  )
}

/** 공개 채팅 페이지 상단 헤더 버튼과 동일 패딩·아이콘 크기 (모달에서 구분을 위해 아주 옅은 테두리만 추가) */
function PageHeaderIconDemo({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex p-1.5 text-gray-600 rounded transition-colors ring-1 ring-gray-200/90 bg-white"
      aria-hidden
    >
      {children}
    </span>
  )
}

/** 메시지 개수 뱃지 (ChatHeader와 동일) */
function MessageCountBadgeDemo({ value = '128' }: { value?: string }) {
  return (
    <span
      className="inline-flex flex-shrink-0 tabular-nums rounded-full bg-blue-600 text-white px-2 py-0.5 text-[11px] font-semibold shadow-sm"
      aria-hidden
    >
      {value}
    </span>
  )
}

/** 입력줄 보조 버튼 (MessageInput과 동일 톤) */
function InputSideIconDemo({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex flex-shrink-0 p-1.5 text-gray-600 rounded-lg border border-gray-200 bg-white"
      aria-hidden
    >
      {children}
    </span>
  )
}

function TutorialRow({ visual, text }: { visual: ReactNode; text: string }) {
  return (
    <li className="flex gap-3 items-start">
      <div className="flex-shrink-0 pt-0.5 flex flex-wrap items-center gap-1.5">{visual}</div>
      <p className="text-sm text-gray-700 leading-relaxed flex-1 min-w-0">{text}</p>
    </li>
  )
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

  const steps: { title: string; content: ReactNode }[] = isKo
    ? [
        {
          title: '투어 채팅방에 오신 것을 환영합니다',
          content: (
            <ul className="space-y-3">
              <TutorialRow
                visual={<MessageSquare size={20} className="text-blue-600" />}
                text="이 페이지에서 가이드·스태프와 실시간으로 메시지를 주고받을 수 있습니다."
              />
              <li className="text-sm text-gray-700 leading-relaxed pl-1">
                다음 단계에서는 화면에 보이는 것과 같은 아이콘·뱃지를 기준으로 버튼을 안내합니다.
              </li>
            </ul>
          )
        },
        {
          title: '맨 위 바 (페이지 헤더)',
          content: (
            <ul className="space-y-3">
              <TutorialRow
                visual={
                  <PageHeaderIconDemo>
                    <Download size={16} />
                  </PageHeaderIconDemo>
                }
                text="다운로드: 이 채팅을 휴대폰 홈 화면에 추가해 앱처럼 쓸 수 있습니다."
              />
              <TutorialRow
                visual={
                  <span className="inline-flex items-center gap-1 ring-1 ring-gray-200/90 bg-white rounded px-1.5 py-1">
                    <BookOpen size={16} className="text-gray-600 flex-shrink-0" />
                    <span className="text-[11px] font-medium text-gray-600 pr-0.5">메뉴얼</span>
                  </span>
                }
                text="책 아이콘(메뉴얼): 이 안내를 언제든지 다시 열 수 있습니다."
              />
              <TutorialRow
                visual={
                  <>
                    <PageHeaderIconDemo>
                      <Bell size={16} className="text-blue-600" />
                    </PageHeaderIconDemo>
                    <PageHeaderIconDemo>
                      <BellOff size={16} />
                    </PageHeaderIconDemo>
                  </>
                }
                text="종 모양: 푸시 알림을 켜거나 끕니다. 켜진 상태에서는 아이콘이 강조될 수 있습니다(브라우저 허용 필요)."
              />
              <TutorialRow
                visual={
                  <>
                    <PageHeaderIconDemo>
                      <ReactCountryFlag countryCode="KR" svg style={{ width: 16, height: 12, borderRadius: 2 }} />
                    </PageHeaderIconDemo>
                    <span className="text-gray-400 text-xs">↔</span>
                    <PageHeaderIconDemo>
                      <ReactCountryFlag countryCode="US" svg style={{ width: 16, height: 12, borderRadius: 2 }} />
                    </PageHeaderIconDemo>
                  </>
                }
                text="국기: 표시 언어를 한국어와 English 사이에서 바꿉니다."
              />
              <TutorialRow
                visual={
                  <span className="inline-flex p-1.5 text-gray-600 rounded lg:hidden border border-gray-200 bg-gray-50">
                    <Menu size={16} />
                  </span>
                }
                text="메뉴(모바일): 채팅 상단의 도구 줄을 접거나 펼칩니다."
              />
            </ul>
          )
        },
        {
          title: '채팅 상단 (제목 · 도구 버튼)',
          content: (
            <ul className="space-y-3">
              <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50/90 px-3 py-2.5 mb-1">
                <p className="text-[11px] text-gray-500 mb-1.5">채팅방 제목 옆 (실제 화면과 동일 스타일)</p>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 truncate flex-1">
                    투어 이름 · 채팅방
                  </span>
                  <MessageCountBadgeDemo />
                </div>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  파란 숫자 뱃지는 이 방에 쌓인 메시지 개수입니다.
                </p>
              </li>
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-amber-100 text-amber-800 border-amber-200">
                    <Megaphone size={18} />
                  </ToolbarIconDemo>
                }
                text="확성기(노란 톤): 공지사항을 엽니다."
              />
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-blue-100 text-blue-800 border-blue-200">
                    <Calendar size={18} />
                  </ToolbarIconDemo>
                }
                text="달력(파란 톤): 픽업 일정·장소를 확인합니다."
              />
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-violet-100 text-violet-800 border-violet-200">
                    <ImageIcon size={18} />
                  </ToolbarIconDemo>
                }
                text="사진(보라 톤): 투어 사진 갤러리를 엽니다."
              />
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-indigo-100 text-indigo-800 border-indigo-200">
                    <Users size={18} />
                  </ToolbarIconDemo>
                }
                text="사람 아이콘(남색 톤): 가이드·팀 정보를 봅니다."
              />
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-green-100 text-green-800 border-green-200">
                    <Phone size={18} />
                  </ToolbarIconDemo>
                }
                text="전화(초록 톤): 가이드가 받을 수 있을 때 음성 통화를 시도합니다."
              />
              <TutorialRow
                visual={
                  <>
                    <span className="inline-flex p-2 text-gray-600 rounded border border-gray-200 bg-white">
                      <Copy size={18} />
                    </span>
                    <span className="inline-flex p-2 text-gray-600 rounded border border-gray-200 bg-white">
                      <Share2 size={18} />
                    </span>
                  </>
                }
                text="복사 · 공유: 채팅방 링크를 복사하거나 다른 앱으로 공유합니다."
              />
              <TutorialRow
                visual={
                  <span className="inline-flex p-2 bg-gray-100 text-gray-700 rounded border border-gray-200">
                    <ChevronDown size={18} />
                  </span>
                }
                text="아래 화살표(회색): 모바일에서 접어 둔 메뉴를 펼칩니다."
              />
              <li className="text-xs text-gray-500 leading-relaxed pl-1 pt-1">
                넓은 화면에서는 같은 기능이 작은 컬러 버튼 줄로 표시될 수 있고, 알림(종)·언어(국기)가 채팅창 오른쪽에만 보일 수도 있습니다.
              </li>
            </ul>
          )
        },
        {
          title: '대화 목록',
          content: (
            <ul className="space-y-3">
              <TutorialRow
                visual={<MessageSquare size={20} className="text-indigo-500" />}
                text="가이드와 주고받은 메시지가 시간 순으로 표시됩니다."
              />
              <li className="text-sm text-gray-700 leading-relaxed pl-1">
                위로 스크롤하면 이전 대화를 볼 수 있습니다.
              </li>
            </ul>
          )
        },
        {
          title: '메시지 입력줄',
          content: (
            <ul className="space-y-3">
              <TutorialRow
                visual={
                  <InputSideIconDemo>
                    <ImageIcon size={18} />
                  </InputSideIconDemo>
                }
                text="사진 아이콘: 이미지를 올려 보냅니다."
              />
              <TutorialRow
                visual={
                  <InputSideIconDemo>
                    <Smile size={18} />
                  </InputSideIconDemo>
                }
                text="웃는 얼굴: 이모지를 넣습니다."
              />
              <TutorialRow
                visual={
                  <InputSideIconDemo>
                    <MapPin size={18} />
                  </InputSideIconDemo>
                }
                text="위치 핀: 현재 위치를 지도로 공유합니다."
              />
              <TutorialRow
                visual={
                  <span className="inline-flex items-center gap-1 flex-wrap">
                    <span className="inline-flex min-w-[120px] h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-400 items-center">
                      ···
                    </span>
                    <span className="inline-flex px-3 py-2 bg-blue-600 text-white rounded-lg items-center gap-1 text-sm font-medium">
                      <Send size={14} />
                      Send
                    </span>
                  </span>
                }
                text="입력창에 글을 쓰고 파란 전송 버튼을 누르거나 Enter로 보냅니다."
              />
            </ul>
          )
        }
      ]
    : [
        {
          title: 'Welcome to your tour chat',
          content: (
            <ul className="space-y-3">
              <TutorialRow
                visual={<MessageSquare size={20} className="text-blue-600" />}
                text="Use this page to message your guide and staff in real time."
              />
              <li className="text-sm text-gray-700 leading-relaxed pl-1">
                The next steps use the same icons and badge styles you will see in the app.
              </li>
            </ul>
          )
        },
        {
          title: 'Top bar (page header)',
          content: (
            <ul className="space-y-3">
              <TutorialRow
                visual={
                  <PageHeaderIconDemo>
                    <Download size={16} />
                  </PageHeaderIconDemo>
                }
                text="Download: Add this chat to your home screen and use it like an app."
              />
              <TutorialRow
                visual={
                  <span className="inline-flex items-center gap-1 ring-1 ring-gray-200/90 bg-white rounded px-1.5 py-1">
                    <BookOpen size={16} className="text-gray-600 flex-shrink-0" />
                    <span className="text-[11px] font-medium text-gray-600 pr-0.5">Guide</span>
                  </span>
                }
                text="Book icon (Guide): Open this walkthrough again any time."
              />
              <TutorialRow
                visual={
                  <>
                    <PageHeaderIconDemo>
                      <Bell size={16} className="text-blue-600" />
                    </PageHeaderIconDemo>
                    <PageHeaderIconDemo>
                      <BellOff size={16} />
                    </PageHeaderIconDemo>
                  </>
                }
                text="Bell icons: Turn push notifications on or off. When on, the icon may appear highlighted (browser permission may be required)."
              />
              <TutorialRow
                visual={
                  <>
                    <PageHeaderIconDemo>
                      <ReactCountryFlag countryCode="KR" svg style={{ width: 16, height: 12, borderRadius: 2 }} />
                    </PageHeaderIconDemo>
                    <span className="text-gray-400 text-xs">↔</span>
                    <PageHeaderIconDemo>
                      <ReactCountryFlag countryCode="US" svg style={{ width: 16, height: 12, borderRadius: 2 }} />
                    </PageHeaderIconDemo>
                  </>
                }
                text="Flag: Switch the display language between Korean and English."
              />
              <TutorialRow
                visual={
                  <span className="inline-flex p-1.5 text-gray-600 rounded lg:hidden border border-gray-200 bg-gray-50">
                    <Menu size={16} />
                  </span>
                }
                text="Menu (mobile): Expand or collapse the chat toolbar."
              />
            </ul>
          )
        },
        {
          title: 'Chat header (title · toolbar)',
          content: (
            <ul className="space-y-3">
              <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50/90 px-3 py-2.5 mb-1">
                <p className="text-[11px] text-gray-500 mb-1.5">Next to the room title (same badge style)</p>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 truncate flex-1">
                    Tour name · Chat Room
                  </span>
                  <MessageCountBadgeDemo />
                </div>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  The blue pill shows how many messages are in this room.
                </p>
              </li>
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-amber-100 text-amber-800 border-amber-200">
                    <Megaphone size={18} />
                  </ToolbarIconDemo>
                }
                text="Megaphone (amber): Open announcements."
              />
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-blue-100 text-blue-800 border-blue-200">
                    <Calendar size={18} />
                  </ToolbarIconDemo>
                }
                text="Calendar (blue): Pickup schedule and locations."
              />
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-violet-100 text-violet-800 border-violet-200">
                    <ImageIcon size={18} />
                  </ToolbarIconDemo>
                }
                text="Image (violet): Tour photo gallery."
              />
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-indigo-100 text-indigo-800 border-indigo-200">
                    <Users size={18} />
                  </ToolbarIconDemo>
                }
                text="People (indigo): Guide and team information."
              />
              <TutorialRow
                visual={
                  <ToolbarIconDemo className="bg-green-100 text-green-800 border-green-200">
                    <Phone size={18} />
                  </ToolbarIconDemo>
                }
                text="Phone (green): Start a voice call when your guide is available."
              />
              <TutorialRow
                visual={
                  <>
                    <span className="inline-flex p-2 text-gray-600 rounded border border-gray-200 bg-white">
                      <Copy size={18} />
                    </span>
                    <span className="inline-flex p-2 text-gray-600 rounded border border-gray-200 bg-white">
                      <Share2 size={18} />
                    </span>
                  </>
                }
                text="Copy · Share: Copy or share this chat link."
              />
              <TutorialRow
                visual={
                  <span className="inline-flex p-2 bg-gray-100 text-gray-700 rounded border border-gray-200">
                    <ChevronDown size={18} />
                  </span>
                }
                text="Chevron (gray): On mobile, expand the folded toolbar."
              />
              <li className="text-xs text-gray-500 leading-relaxed pl-1 pt-1">
                On large screens the same actions may appear as a compact colored row; bell and language may only show on the right inside the chat header.
              </li>
            </ul>
          )
        },
        {
          title: 'Message list',
          content: (
            <ul className="space-y-3">
              <TutorialRow
                visual={<MessageSquare size={20} className="text-indigo-500" />}
                text="Messages are listed in chronological order."
              />
              <li className="text-sm text-gray-700 leading-relaxed pl-1">Scroll up to read older messages.</li>
            </ul>
          )
        },
        {
          title: 'Message input',
          content: (
            <ul className="space-y-3">
              <TutorialRow
                visual={
                  <InputSideIconDemo>
                    <ImageIcon size={18} />
                  </InputSideIconDemo>
                }
                text="Image: Upload and send a photo."
              />
              <TutorialRow
                visual={
                  <InputSideIconDemo>
                    <Smile size={18} />
                  </InputSideIconDemo>
                }
                text="Smile: Open the emoji picker."
              />
              <TutorialRow
                visual={
                  <InputSideIconDemo>
                    <MapPin size={18} />
                  </InputSideIconDemo>
                }
                text="Map pin: Share your current location on a map."
              />
              <TutorialRow
                visual={
                  <span className="inline-flex items-center gap-1 flex-wrap">
                    <span className="inline-flex min-w-[120px] h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-400 items-center">
                      ···
                    </span>
                    <span className="inline-flex px-3 py-2 bg-blue-600 text-white rounded-lg items-center gap-1 text-sm font-medium">
                      <Send size={14} />
                      Send
                    </span>
                  </span>
                }
                text="Type in the field and tap the blue Send button (or press Enter)."
              />
            </ul>
          )
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
          {current.content}
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
