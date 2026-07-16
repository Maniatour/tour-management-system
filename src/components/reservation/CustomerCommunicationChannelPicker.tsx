'use client'

import { useEffect, useRef, useState } from 'react'
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
  /** 드롭다운 정렬 (오른쪽 열에 둘 때 right) */
  align?: 'left' | 'right'
}

export function CustomerCommunicationChannelPicker({
  value,
  channelId,
  channelName,
  disabled = false,
  onChange,
  compact = false,
  align = 'left',
}: CustomerCommunicationChannelPickerProps) {
  const t = useTranslations('reservations.card')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = resolveCustomerCommunicationChannel(value, {
    ...(channelId !== undefined ? { channelId: channelId ?? null } : {}),
    ...(channelName !== undefined ? { channelName: channelName ?? null } : {}),
  })

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

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

  return (
    <div
      className={
        compact
          ? 'relative inline-flex h-4 w-4 shrink-0 items-center justify-center'
          : 'relative inline-flex shrink-0 items-center justify-center'
      }
      ref={rootRef}
    >
      <button
        type="button"
        disabled={disabled || saving}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={
          compact
            ? 'inline-flex h-4 w-4 items-center justify-center rounded p-0 leading-none hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
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
              ? 'inline-flex h-4 w-4 items-center justify-center leading-none'
              : 'inline-flex h-4 w-4 items-center justify-center leading-none'
          }
        >
          {renderCustomerCommunicationChannelIcon(current, 'h-4 w-4')}
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={t('communicationChannel.pickerListAria')}
          className={`absolute top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
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
                  {renderCustomerCommunicationChannelIcon(channel, 'h-4 w-4')}
                </span>
                <span className="text-gray-800">{t(communicationChannelLabelKey(channel))}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
