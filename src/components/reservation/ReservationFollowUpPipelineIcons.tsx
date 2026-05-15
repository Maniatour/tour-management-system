'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Mail, ClipboardCheck, Plane, MapPin, Minus, MessageSquare } from 'lucide-react'
import type { ReservationFollowUpPipelineSnapshot } from '@/lib/reservationFollowUpPipeline'
import {
  prerequisitesMetForDeparture,
  prerequisitesMetForPickup,
  followUpPipelineStepCanMarkManual,
  followUpPipelineStepCanClearManual,
  type FollowUpPipelineStepKey,
} from '@/lib/reservationFollowUpPipeline'

export type FollowUpPipelineEmailType =
  | 'confirmation'
  | 'resident_inquiry'
  | 'departure'
  | 'pickup'

type StepVisual = 'done' | 'action' | 'upcoming' | 'na'

function stepClasses(v: StepVisual): string {
  if (v === 'done') return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (v === 'action') return 'text-amber-800 bg-amber-50 border-amber-300 ring-1 ring-amber-200'
  if (v === 'na') return 'text-gray-300 bg-gray-50 border-gray-100 opacity-70'
  return 'text-gray-400 bg-gray-50 border-gray-100'
}

function resolveSteps(s: ReservationFollowUpPipelineSnapshot): {
  confirm: StepVisual
  resident: StepVisual
  departure: StepVisual
  pickup: StepVisual
} {
  const confirm: StepVisual = s.confirmationSent ? 'done' : 'action'

  let resident: StepVisual = 'na'
  if (s.needsResidentFlow) {
    if (s.guestResidentFlowCompleted && s.residentInquirySent) resident = 'done'
    else if (!s.residentInquirySent || !s.guestResidentFlowCompleted) resident = 'action'
  }

  let departure: StepVisual = 'upcoming'
  if (!prerequisitesMetForDeparture(s)) departure = 'upcoming'
  else if (s.departureSent) departure = 'done'
  else departure = 'action'

  let pickup: StepVisual = 'upcoming'
  if (!prerequisitesMetForPickup(s)) pickup = 'upcoming'
  else if (s.pickupSent) pickup = 'done'
  else pickup = 'action'

  return { confirm, resident, departure, pickup }
}

function emailTypeForStepKey(
  key: string,
  residentVisual: StepVisual
): FollowUpPipelineEmailType | null {
  if (key === 'c') return 'confirmation'
  if (key === 'r') return residentVisual === 'na' ? null : 'resident_inquiry'
  if (key === 'd') return 'departure'
  if (key === 'p') return 'pickup'
  return null
}

function pipelineStepFromIconKey(key: string): FollowUpPipelineStepKey | null {
  if (key === 'c') return 'confirmation'
  if (key === 'r') return 'resident'
  if (key === 'd') return 'departure'
  if (key === 'p') return 'pickup'
  return null
}

function stepManualFlag(snapshot: ReservationFollowUpPipelineSnapshot, step: FollowUpPipelineStepKey): boolean {
  if (step === 'confirmation') return snapshot.manualConfirmation
  if (step === 'resident') return snapshot.manualResident
  if (step === 'departure') return snapshot.manualDeparture
  return snapshot.manualPickup
}

type PipelineMenuState = {
  clientX: number
  clientY: number
  step: FollowUpPipelineStepKey
  emailType: FollowUpPipelineEmailType | null
}

export function ReservationFollowUpPipelineIcons({
  snapshot,
  disabled,
  onEmailPreviewClick,
  showTourChatRoomPreviewButton,
  onTourChatRoomPreviewClick,
  allowManualCompletion,
  onManualStepChange,
}: {
  snapshot: ReservationFollowUpPipelineSnapshot | null | undefined
  /** 취소·삭제 등 파이프라인 비적용 */
  disabled?: boolean
  /** 단계별 이메일 미리보기 (거주 미해당 상품은 거주 아이콘 비활성) */
  onEmailPreviewClick?: (emailType: FollowUpPipelineEmailType) => void
  /** 간단 카드: 픽업 아이콘 옆 Tour Chat Room 섹션 미리보기 */
  showTourChatRoomPreviewButton?: boolean
  onTourChatRoomPreviewClick?: () => void
  /** 간단 카드 등: 우클릭으로 다른 채널 완료 표시 */
  allowManualCompletion?: boolean
  onManualStepChange?: (step: FollowUpPipelineStepKey, action: 'mark' | 'clear') => void | Promise<void>
}) {
  const t = useTranslations('reservations')
  const [menu, setMenu] = useState<PipelineMenuState | null>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (ev: PointerEvent) => {
      const el = menuPanelRef.current
      if (el && ev.target instanceof Node && el.contains(ev.target)) return
      setMenu(null)
    }
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', close, true)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('pointerdown', close, true)
    }
  }, [menu])

  if (!snapshot || disabled) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-gray-300" aria-hidden>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-100 bg-gray-50">
          <Minus className="h-3 w-3" />
        </span>
      </div>
    )
  }

  const { confirm, resident, departure, pickup } = resolveSteps(snapshot)

  const items: { key: string; Icon: typeof Mail; visual: StepVisual; label: string }[] = [
    { key: 'c', Icon: Mail, visual: confirm, label: t('followUpPipeline.step1IconTitle') },
    {
      key: 'r',
      Icon: resident === 'na' ? Minus : ClipboardCheck,
      visual: resident,
      label: resident === 'na' ? t('followUpPipeline.step2SkipTitle') : t('followUpPipeline.step2IconTitle'),
    },
    { key: 'd', Icon: Plane, visual: departure, label: t('followUpPipeline.step3IconTitle') },
    { key: 'p', Icon: MapPin, visual: pickup, label: t('followUpPipeline.step4IconTitle') },
  ]

  const manualEnabled = !!allowManualCompletion && !!onManualStepChange

  const renderMenu = () => {
    if (!menu || typeof document === 'undefined') return null
    const pad = 8
    const w = 220
    const left = Math.min(menu.clientX, window.innerWidth - w - pad)
    const top = Math.min(menu.clientY, window.innerHeight - 160 - pad)
    const canMark = followUpPipelineStepCanMarkManual(snapshot, menu.step)
    const canClear = followUpPipelineStepCanClearManual(snapshot, menu.step)
    const showPreview = !!onEmailPreviewClick && menu.emailType != null

    return createPortal(
      <div
        ref={menuPanelRef}
        role="menu"
        className="fixed z-[200] w-[220px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg text-xs"
        style={{ left, top }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {showPreview ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-gray-800 hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation()
              onEmailPreviewClick(menu.emailType!)
              setMenu(null)
            }}
          >
            {t('followUpPipeline.contextEmailPreview')}
          </button>
        ) : null}
        {manualEnabled && canMark ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-gray-800 hover:bg-gray-50"
            onClick={async (e) => {
              e.stopPropagation()
              try {
                await onManualStepChange!(menu.step, 'mark')
              } catch (err) {
                console.error(err)
              } finally {
                setMenu(null)
              }
            }}
          >
            {t('followUpPipeline.contextMarkManualOtherChannel')}
          </button>
        ) : null}
        {manualEnabled && canClear ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-amber-900 hover:bg-amber-50"
            onClick={async (e) => {
              e.stopPropagation()
              try {
                await onManualStepChange!(menu.step, 'clear')
              } catch (err) {
                console.error(err)
              } finally {
                setMenu(null)
              }
            }}
          >
            {t('followUpPipeline.contextClearManualMark')}
          </button>
        ) : null}
        {!showPreview && !((manualEnabled && canMark) || (manualEnabled && canClear)) ? (
          <div className="px-3 py-2 text-gray-400">{t('followUpPipeline.contextNoActions')}</div>
        ) : null}
      </div>,
      document.body
    )
  }

  return (
    <>
      <div
        className="inline-flex items-center gap-0.5"
        role="group"
        aria-label={t('followUpPipeline.ariaPipelineStatus')}
        title={manualEnabled ? t('followUpPipeline.pipelineHintManual') : undefined}
      >
        {items.map(({ key, Icon, visual, label }) => {
          const emailType = emailTypeForStepKey(key, resident)
          const pipelineStep = pipelineStepFromIconKey(key)
          const interactive = !!onEmailPreviewClick && emailType != null
          const menuApplicable =
            manualEnabled && !!pipelineStep && !(key === 'r' && resident === 'na')
          const manualPart = pipelineStep && stepManualFlag(snapshot, pipelineStep)
          const boxClass = `inline-flex h-6 w-6 items-center justify-center rounded border ${stepClasses(visual)}`
          const titleSuffix = manualPart ? ` — ${t('followUpPipeline.manualBadgeTitle')}` : ''

          const openMenu = (clientX: number, clientY: number) => {
            if (!menuApplicable || !pipelineStep) return
            setMenu({
              clientX,
              clientY,
              step: pipelineStep,
              emailType,
            })
          }

          const iconButton = interactive ? (
            <button
              key={key}
              type="button"
              title={`${label}${titleSuffix}`}
              aria-label={`${label}${titleSuffix}`}
              className={`${boxClass} cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1`}
              onClick={(e) => {
                e.stopPropagation()
                onEmailPreviewClick(emailType)
              }}
              onContextMenu={(e) => {
                if (!menuApplicable) return
                e.preventDefault()
                e.stopPropagation()
                openMenu(e.clientX, e.clientY)
              }}
            >
              <Icon className="h-3 w-3 shrink-0 pointer-events-none" aria-hidden />
            </button>
          ) : (
            <span
              key={key}
              title={`${label}${titleSuffix}`}
              className={boxClass}
              onContextMenu={(e) => {
                if (!menuApplicable) return
                e.preventDefault()
                e.stopPropagation()
                openMenu(e.clientX, e.clientY)
              }}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
            </span>
          )

          if (key === 'p' && showTourChatRoomPreviewButton && onTourChatRoomPreviewClick) {
            return (
              <React.Fragment key={key}>
                {iconButton}
                <button
                  type="button"
                  title={t('followUpPipeline.tourChatRoomPreviewButtonTitle')}
                  aria-label={t('followUpPipeline.tourChatRoomPreviewButtonTitle')}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border text-emerald-700 bg-emerald-50 border-emerald-200 cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTourChatRoomPreviewClick()
                  }}
                >
                  <MessageSquare className="h-3 w-3 shrink-0 pointer-events-none" aria-hidden />
                </button>
              </React.Fragment>
            )
          }

          return iconButton
        })}
      </div>
      {renderMenu()}
    </>
  )
}
