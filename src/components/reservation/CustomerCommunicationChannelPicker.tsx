'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  CUSTOMER_COMMUNICATION_CHANNELS,
  type CustomerCommunicationChannel,
  communicationChannelLabelKey,
  resolveCustomerCommunicationChannel,
  renderCustomerCommunicationChannelIcon,
} from '@/lib/customerCommunicationChannel'

export type CustomerCommunicationChannelPickerProps = {
  value: string | null | undefined
  channelId?: string | null
  channelName?: string | null
  disabled?: boolean
  onChange: (channel: CustomerCommunicationChannel) => void | Promise<void>
  /** 간단 카드: 채널 파비콘(h-4)과 맞춘 작은 버튼 */
  compact?: boolean
  /** compact보다 더 작은 버튼 (투어 상세 모달 카드) */
  dense?: boolean
  /** 드롭다운 정렬 (오른쪽 열에 둘 때 right) */
  align?: 'left' | 'right'
  /** 드롭다운 열림 방향 (compact 기본: top — 아래 카드에 가려지지 않도록) */
  placement?: 'top' | 'bottom'
}

export function CustomerCommunicationChannelPicker({
  value,
  channelId,
  channelName,
  disabled = false,
  onChange,
  compact = false,
  dense = false,
  align = 'left',
  placement: placementProp,
}: CustomerCommunicationChannelPickerProps) {
  const t = useTranslations('reservations.card')
  const placement = placementProp ?? (compact ? 'top' : 'bottom')
  const usePortal = compact
  const iconSizeClass = dense ? 'h-3 w-3' : 'h-4 w-4'
  const buttonSizeClass = dense ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const current = resolveCustomerCommunicationChannel(value, {
    ...(channelId !== undefined ? { channelId: channelId ?? null } : {}),
    ...(channelName !== undefined ? { channelName: channelName ?? null } : {}),
  })

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useLayoutEffect(() => {
    if (!open || !usePortal) {
      setPanelPos(null)
      return
    }

    const positionPanel = () => {
      const btn = buttonRef.current
      const panel = panelRef.current
      if (!btn) return

      const rect = btn.getBoundingClientRect()
      const menuWidth = panel?.offsetWidth ?? 176
      const menuHeight = panel?.offsetHeight ?? 280
      const pad = 8

      let left = align === 'right' ? rect.right - menuWidth : rect.left
      left = Math.min(Math.max(pad, left), window.innerWidth - menuWidth - pad)

      let top = placement === 'top' ? rect.top - menuHeight - 4 : rect.bottom + 4
      top = Math.max(pad, Math.min(top, window.innerHeight - menuHeight - pad))

      setPanelPos({ top, left })
    }

    positionPanel()
    const raf = requestAnimationFrame(positionPanel)
    window.addEventListener('resize', positionPanel)
    const closeOnScroll = () => setOpen(false)
    window.addEventListener('scroll', closeOnScroll, true)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', positionPanel)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [open, usePortal, placement, align])

  const pick = async (channel: CustomerCommunicationChannel) => {
    if (disabled || saving || channel === current) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      await onChange(channel)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const dropdown = open ? (
    <div
      ref={panelRef}
      role="listbox"
      aria-label={t('communicationChannel.pickerListAria')}
      className={
        usePortal
          ? 'fixed z-[10000] min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg'
          : `absolute z-50 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg ${
              placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
            } ${align === 'right' ? 'right-0' : 'left-0'}`
      }
      style={
        usePortal
          ? panelPos
            ? { top: panelPos.top, left: panelPos.left }
            : { visibility: 'hidden', top: 0, left: 0 }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
    >
      {CUSTOMER_COMMUNICATION_CHANNELS.map((channel) => {
        const selected = channel === current
        return (
          <button
            key={channel}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={saving}
            onClick={() => void pick(channel)}
            className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-50 ${
              selected ? 'bg-gray-50 font-medium' : ''
            }`}
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              {renderCustomerCommunicationChannelIcon(channel, iconSizeClass)}
            </span>
            <span className="text-gray-800">{t(communicationChannelLabelKey(channel))}</span>
          </button>
        )
      })}
    </div>
  ) : null

  return (
    <div
      className={
        compact
          ? `relative inline-flex ${buttonSizeClass} shrink-0 items-center justify-center`
          : 'relative inline-flex shrink-0 items-center justify-center'
      }
      ref={rootRef}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || saving}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={
          compact
            ? `inline-flex ${buttonSizeClass} items-center justify-center rounded p-0 leading-none hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50`
            : 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white p-0 leading-none hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
        }
        title={t(communicationChannelLabelKey(current))}
        aria-label={t('communicationChannel.pickerAria', { channel: t(communicationChannelLabelKey(current)) })}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span
          className={
            compact
              ? `inline-flex ${buttonSizeClass} items-center justify-center leading-none`
              : 'inline-flex h-4 w-4 items-center justify-center leading-none'
          }
        >
          {renderCustomerCommunicationChannelIcon(current, iconSizeClass)}
        </span>
      </button>
      {usePortal
        ? portalReady && dropdown
          ? createPortal(dropdown, document.body)
          : null
        : dropdown}
    </div>
  )
}
