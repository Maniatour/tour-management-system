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
  BookOpen,
} from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import type { SupportedLanguage } from '@/lib/translation'
import { usePublicChatTutorial } from '@/hooks/usePublicChatMessages'

interface PublicChatTutorialOverlayProps {
  open: boolean
  language: SupportedLanguage
  onClose: () => void
  onComplete: () => void
}

function ToolbarIconDemo({
  className,
  children,
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
  onComplete,
}: PublicChatTutorialOverlayProps) {
  const [step, setStep] = useState(0)
  const t = usePublicChatTutorial(language)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null

  const steps: { title: string; content: ReactNode }[] = [
    {
      title: t('step0Title'),
      content: (
        <ul className="space-y-3">
          <TutorialRow
            visual={<MessageSquare size={20} className="text-blue-600" />}
            text={t('step0Row1')}
          />
          <li className="text-sm text-gray-700 leading-relaxed pl-1">{t('step0Row2')}</li>
        </ul>
      ),
    },
    {
      title: t('step1Title'),
      content: (
        <ul className="space-y-3">
          <TutorialRow
            visual={
              <PageHeaderIconDemo>
                <Download size={16} />
              </PageHeaderIconDemo>
            }
            text={t('step1Download')}
          />
          <TutorialRow
            visual={
              <span className="inline-flex items-center gap-1 ring-1 ring-gray-200/90 bg-white rounded px-1.5 py-1">
                <BookOpen size={16} className="text-gray-600 flex-shrink-0" />
                <span className="text-[11px] font-medium text-gray-600 pr-0.5">
                  {t('manualShort')}
                </span>
              </span>
            }
            text={t('step1Manual')}
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
            text={t('step1Bell')}
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
            text={t('step1Flag')}
          />
          <TutorialRow
            visual={
              <span className="inline-flex p-1.5 text-gray-600 rounded lg:hidden border border-gray-200 bg-gray-50">
                <Menu size={16} />
              </span>
            }
            text={t('step1Menu')}
          />
        </ul>
      ),
    },
    {
      title: t('step2Title'),
      content: (
        <ul className="space-y-3">
          <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50/90 px-3 py-2.5 mb-1">
            <p className="text-[11px] text-gray-500 mb-1.5">{t('step2DemoCaption')}</p>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-900 truncate flex-1">
                {t('step2DemoTitle')}
              </span>
              <MessageCountBadgeDemo />
            </div>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">{t('step2BadgeHint')}</p>
          </li>
          <TutorialRow
            visual={
              <ToolbarIconDemo className="bg-amber-100 text-amber-800 border-amber-200">
                <Megaphone size={18} />
              </ToolbarIconDemo>
            }
            text={t('step2Megaphone')}
          />
          <TutorialRow
            visual={
              <ToolbarIconDemo className="bg-blue-100 text-blue-800 border-blue-200">
                <Calendar size={18} />
              </ToolbarIconDemo>
            }
            text={t('step2Calendar')}
          />
          <TutorialRow
            visual={
              <ToolbarIconDemo className="bg-violet-100 text-violet-800 border-violet-200">
                <ImageIcon size={18} />
              </ToolbarIconDemo>
            }
            text={t('step2Image')}
          />
          <TutorialRow
            visual={
              <ToolbarIconDemo className="bg-indigo-100 text-indigo-800 border-indigo-200">
                <Users size={18} />
              </ToolbarIconDemo>
            }
            text={t('step2People')}
          />
          <TutorialRow
            visual={
              <ToolbarIconDemo className="bg-green-100 text-green-800 border-green-200">
                <Phone size={18} />
              </ToolbarIconDemo>
            }
            text={t('step2Phone')}
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
            text={t('step2CopyShare')}
          />
          <TutorialRow
            visual={
              <span className="inline-flex p-2 bg-gray-100 text-gray-700 rounded border border-gray-200">
                <ChevronDown size={18} />
              </span>
            }
            text={t('step2Chevron')}
          />
          <li className="text-xs text-gray-500 leading-relaxed pl-1 pt-1">{t('step2WideScreenNote')}</li>
        </ul>
      ),
    },
    {
      title: t('step3Title'),
      content: (
        <ul className="space-y-3">
          <TutorialRow
            visual={<MessageSquare size={20} className="text-indigo-500" />}
            text={t('step3Messages')}
          />
          <li className="text-sm text-gray-700 leading-relaxed pl-1">{t('step3Scroll')}</li>
        </ul>
      ),
    },
    {
      title: t('step4Title'),
      content: (
        <ul className="space-y-3">
          <TutorialRow
            visual={
              <InputSideIconDemo>
                <ImageIcon size={18} />
              </InputSideIconDemo>
            }
            text={t('step4Image')}
          />
          <TutorialRow
            visual={
              <InputSideIconDemo>
                <Smile size={18} />
              </InputSideIconDemo>
            }
            text={t('step4Emoji')}
          />
          <TutorialRow
            visual={
              <InputSideIconDemo>
                <MapPin size={18} />
              </InputSideIconDemo>
            }
            text={t('step4Location')}
          />
          <TutorialRow
            visual={
              <span className="inline-flex items-center gap-1 flex-wrap">
                <span className="inline-flex min-w-[120px] h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-400 items-center">
                  ···
                </span>
                <span className="inline-flex px-3 py-2 bg-blue-600 text-white rounded-lg items-center gap-1 text-sm font-medium">
                  <Send size={14} />
                  {t('send')}
                </span>
              </span>
            }
            text={t('step4Send')}
          />
        </ul>
      ),
    },
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
            {t('guideProgress', { step: step + 1, total: steps.length })}
          </p>
          <button
            type="button"
            onClick={handleFinish}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label={t('close')}
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
            {t('skip')}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
              >
                <ChevronLeft size={16} />
                {t('back')}
              </button>
            )}
            {step < last ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(last, s + 1))}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                {t('next')}
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                {t('gotIt')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
