'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { Mail, ClipboardCheck, Plane, MapPin, MessageSquare } from 'lucide-react'
import type { ReservationFollowUpPipelineSnapshot } from '@/lib/reservationFollowUpPipeline'
import {
  prerequisitesMetForPickup,
  followUpPipelineStepCanMarkManual,
  followUpPipelineStepCanClearManual,
  type FollowUpPipelineStepKey,
} from '@/lib/reservationFollowUpPipeline'
import type { FollowUpPipelineEmailType } from '@/lib/emailLogDeliveryState'
import {
  resolvePipelineStepPresentation,
  resolvePipelineSteps,
  type PipelineStepVisual,
} from '@/lib/pipelineStepPresentation'
import { buildPipelineStepStatusSuffix } from '@/lib/followUpPipelineStatusLabels'

export type { FollowUpPipelineEmailType }

type StepVisual = PipelineStepVisual

function emailTypeForStepKey(key: string): FollowUpPipelineEmailType | null {
  if (key === 'c') return 'confirmation'
  if (key === 'r') return 'resident_inquiry'
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

const EMPTY_PIPELINE_SNAPSHOT: ReservationFollowUpPipelineSnapshot = {
  confirmationSent: false,
  confirmationSentDirect: false,
  confirmationInferredFromDeparture: false,
  residentInquirySent: false,
  guestResidentFlowCompleted: false,
  departureSent: false,
  pickupSent: false,
  needsResidentFlow: false,
  manualConfirmation: false,
  manualResident: false,
  manualDeparture: false,
  manualPickup: false,
  cancelFollowUpManual: false,
  cancelRebookingOutreachManual: false,
  emailDelivery: {},
}

function resolveEffectivePipelineSnapshot(
  snapshot: ReservationFollowUpPipelineSnapshot | null | undefined
): ReservationFollowUpPipelineSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    return EMPTY_PIPELINE_SNAPSHOT
  }
  return { ...EMPTY_PIPELINE_SNAPSHOT, ...snapshot }
}

type PipelineMenuState = {
  clientX: number
  clientY: number
  step: FollowUpPipelineStepKey
  emailType: FollowUpPipelineEmailType | null
}

export function ReservationFollowUpPipelineIcons({
  snapshot,
  snapshotLoaded = false,
  disabled,
  onEmailPreviewClick,
  onEmailLogsClick,
  showTourChatRoomPreviewButton,
  onTourChatRoomPreviewClick,
  allowManualCompletion,
  onManualStepChange,
}: {
  snapshot: ReservationFollowUpPipelineSnapshot | null | undefined
  /** 스냅샷 DB 조회 완료 여부 (미완료 시 로딩 회색) */
  snapshotLoaded?: boolean
  disabled?: boolean
  onEmailPreviewClick?: (emailType: FollowUpPipelineEmailType) => void
  onEmailLogsClick?: () => void
  showTourChatRoomPreviewButton?: boolean
  onTourChatRoomPreviewClick?: () => void
  allowManualCompletion?: boolean
  onManualStepChange?: (step: FollowUpPipelineStepKey, action: 'mark' | 'clear') => void | Promise<void>
}) {
  const t = useTranslations('reservations')
  const tPipeline = useTranslations('reservations.followUpPipeline')
  const locale = useLocale()
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

  if (disabled) {
    return null
  }

  const effectiveSnapshot = resolveEffectivePipelineSnapshot(snapshot)
  const loaded = snapshotLoaded && snapshot != null

  const { confirm, resident, departure, pickup, showResidentStep } = loaded
    ? resolvePipelineSteps(effectiveSnapshot)
    : {
        confirm: 'action' as StepVisual,
        resident: 'na' as StepVisual,
        departure: 'upcoming' as StepVisual,
        pickup: 'upcoming' as StepVisual,
        showResidentStep: false,
      }

  const tourChatVisual: StepVisual = !loaded
    ? 'upcoming'
    : !prerequisitesMetForPickup(effectiveSnapshot)
      ? 'upcoming'
      : effectiveSnapshot.pickupSent
        ? 'done'
        : 'action'

  const allItems: { key: string; Icon: typeof Mail; visual: StepVisual; label: string }[] = [
    {
      key: 'c',
      Icon: Mail,
      visual: confirm,
      label: effectiveSnapshot.confirmationInferredFromDeparture
        ? t('followUpPipeline.step1IconTitleInferred')
        : t('followUpPipeline.step1IconTitle'),
    },
    {
      key: 'r',
      Icon: ClipboardCheck,
      visual: resident,
      label: t('followUpPipeline.step2IconTitle'),
    },
    { key: 'd', Icon: Plane, visual: departure, label: t('followUpPipeline.step3IconTitle') },
    { key: 'p', Icon: MapPin, visual: pickup, label: t('followUpPipeline.step4IconTitle') },
  ]

  const items = showResidentStep ? allItems : allItems.filter((item) => item.key !== 'r')

  const manualEnabled = !!allowManualCompletion && !!onManualStepChange

  const renderMenu = () => {
    if (!menu || typeof document === 'undefined') return null
    const pad = 8
    const w = 220
    const left = Math.min(menu.clientX, window.innerWidth - w - pad)
    const top = Math.min(menu.clientY, window.innerHeight - 220 - pad)
    const canMark = followUpPipelineStepCanMarkManual(effectiveSnapshot, menu.step)
    const canClear = followUpPipelineStepCanClearManual(effectiveSnapshot, menu.step)
    const showPreview = !!onEmailPreviewClick && menu.emailType != null
    const showEmailLogs = !!onEmailLogsClick

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
        {showEmailLogs ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-primary hover:bg-muted/50"
            onClick={(e) => {
              e.stopPropagation()
              onEmailLogsClick!()
              setMenu(null)
            }}
          >
            {t('followUpPipeline.contextEmailLogs')}
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
            {t('followUpPipeline.contextMarkManualSend')}
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
        {!showPreview && !showEmailLogs && !((manualEnabled && canMark) || (manualEnabled && canClear)) ? (
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
        title={
          manualEnabled || onEmailLogsClick ? t('followUpPipeline.pipelineHintManualWithLogs') : undefined
        }
      >
        {items.map(({ key, Icon, visual, label }) => {
          const emailType = emailTypeForStepKey(key)
          const pipelineStep = pipelineStepFromIconKey(key)
          const interactive = !!onEmailPreviewClick && emailType != null
          const menuApplicable = manualEnabled && !!pipelineStep
          const canOpenContextMenu =
            (!!interactive || !!onEmailLogsClick || menuApplicable) && !!pipelineStep

          const presentation =
            pipelineStep != null
              ? resolvePipelineStepPresentation({
                  snapshotLoaded: loaded,
                  visual,
                  snapshot: effectiveSnapshot,
                  step: pipelineStep,
                  emailType,
                })
              : {
                  sendChannel: 'none' as const,
                  deliveryOutcome: 'not_sent' as const,
                  isInferred: false,
                  phase: 'inactive' as const,
                  boxClassName: 'text-gray-400 bg-gray-50 border-2 border-gray-200',
                }

          const boxClass = `inline-flex h-6 w-6 items-center justify-center rounded leading-none ${presentation.boxClassName}`
          const titleSuffix = buildPipelineStepStatusSuffix(presentation, tPipeline, locale)

          const openMenu = (clientX: number, clientY: number) => {
            if (!canOpenContextMenu || !pipelineStep) return
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
              className={`${boxClass} cursor-pointer p-0 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1`}
              onClick={(e) => {
                e.stopPropagation()
                onEmailPreviewClick(emailType!)
              }}
              onContextMenu={(e) => {
                if (!canOpenContextMenu) return
                e.preventDefault()
                e.stopPropagation()
                openMenu(e.clientX, e.clientY)
              }}
            >
              <Icon className="block h-3 w-3 shrink-0 pointer-events-none" aria-hidden />
            </button>
          ) : (
            <span
              key={key}
              title={`${label}${titleSuffix}`}
              className={canOpenContextMenu ? `${boxClass} cursor-context-menu` : boxClass}
              onContextMenu={(e) => {
                if (!canOpenContextMenu) return
                e.preventDefault()
                e.stopPropagation()
                openMenu(e.clientX, e.clientY)
              }}
            >
              <Icon className="block h-3 w-3 shrink-0" aria-hidden />
            </span>
          )

          if (key === 'p' && showTourChatRoomPreviewButton && onTourChatRoomPreviewClick) {
            const pickupPresentation = resolvePipelineStepPresentation({
              snapshotLoaded: loaded,
              visual: tourChatVisual,
              snapshot: effectiveSnapshot,
              step: 'pickup',
              emailType: 'pickup',
            })
            const tourChatTitle = t('followUpPipeline.tourChatRoomPreviewButtonTitle')
            const tourChatBoxClass = `inline-flex h-6 w-6 items-center justify-center rounded leading-none ${pickupPresentation.boxClassName}`
            const tourChatMenuApplicable = manualEnabled && prerequisitesMetForPickup(effectiveSnapshot)
            const tourChatCanOpenMenu = tourChatMenuApplicable || !!onEmailLogsClick
            const openTourChatMenu = (clientX: number, clientY: number) => {
              if (!tourChatCanOpenMenu) return
              setMenu({
                clientX,
                clientY,
                step: 'pickup',
                emailType: 'pickup',
              })
            }
            return (
              <React.Fragment key={key}>
                {iconButton}
                <button
                  type="button"
                  title={`${tourChatTitle}${buildPipelineStepStatusSuffix(pickupPresentation, tPipeline, locale)}`}
                  aria-label={`${tourChatTitle}${buildPipelineStepStatusSuffix(pickupPresentation, tPipeline, locale)}`}
                  className={`${tourChatBoxClass} cursor-pointer p-0 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onTourChatRoomPreviewClick()
                  }}
                  onContextMenu={(e) => {
                    if (!tourChatCanOpenMenu) return
                    e.preventDefault()
                    e.stopPropagation()
                    openTourChatMenu(e.clientX, e.clientY)
                  }}
                >
                  <MessageSquare className="block h-3 w-3 shrink-0 pointer-events-none" aria-hidden />
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
