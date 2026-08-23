'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle, ChevronDown, Clock, Loader2, XCircle } from 'lucide-react'
import { DROPDOWN_Z_INDEX } from '@/lib/dialogZIndex'

export const PAYMENT_METHOD_STATUS_OPTIONS = [
  {
    value: 'active',
    label: '활성',
    description: '결제·지출에서 사용할 수 있습니다.',
    icon: CheckCircle,
    badgeClass: 'bg-green-100 text-green-800',
    selectedClass: 'border-green-500 bg-green-50 text-green-900',
  },
  {
    value: 'inactive',
    label: '비활성',
    description: '목록에는 보이지만 선택에서 제외됩니다.',
    icon: XCircle,
    badgeClass: 'bg-gray-100 text-gray-800',
    selectedClass: 'border-gray-400 bg-gray-50 text-gray-900',
  },
  {
    value: 'suspended',
    label: '정지',
    description: '일시적으로 사용을 멈춥니다.',
    icon: AlertTriangle,
    badgeClass: 'bg-yellow-100 text-yellow-800',
    selectedClass: 'border-amber-500 bg-amber-50 text-amber-950',
  },
  {
    value: 'expired',
    label: '만료',
    description: '더 이상 유효하지 않습니다.',
    icon: Clock,
    badgeClass: 'bg-red-100 text-red-800',
    selectedClass: 'border-red-400 bg-red-50 text-red-950',
  },
] as const

export type PaymentMethodStatusValue = (typeof PAYMENT_METHOD_STATUS_OPTIONS)[number]['value']

function statusOption(status: string) {
  return PAYMENT_METHOD_STATUS_OPTIONS.find((o) => o.value === status) ?? PAYMENT_METHOD_STATUS_OPTIONS[1]
}

type PaymentMethodStatusPickerProps = {
  currentStatus: string
  methodId: string
  methodLabel: string
  onSelect: (status: PaymentMethodStatusValue) => Promise<void>
}

export default function PaymentMethodStatusPicker({
  currentStatus,
  methodId,
  methodLabel,
  onSelect,
}: PaymentMethodStatusPickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const current = statusOption(currentStatus)
  const CurrentIcon = current.icon

  const updatePosition = () => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = panel?.offsetWidth ?? 288
    const height = panel?.offsetHeight ?? 268
    let top = rect.bottom + 6
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - height - 6)
    }
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const rect = triggerRef.current?.getBoundingClientRect()
          if (rect) setPos({ top: rect.bottom + 6, left: rect.left })
          setOpen((v) => !v)
        }}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs transition hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${current.badgeClass}`}
        title="상태 변경"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${current.label} — 상태 변경`}
      >
        <CurrentIcon size={14} aria-hidden />
        <span>{current.label}</span>
        <ChevronDown size={12} className="opacity-70" aria-hidden />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div
                className="fixed inset-0"
                style={{ zIndex: DROPDOWN_Z_INDEX }}
                onClick={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                role="listbox"
                aria-label={`${methodLabel || methodId} 상태`}
                className="fixed w-72 rounded-xl border border-border bg-white p-1.5 shadow-md"
                style={{ zIndex: DROPDOWN_Z_INDEX + 1, top: pos.top, left: pos.left }}
              >
                {PAYMENT_METHOD_STATUS_OPTIONS.map((option) => {
                  const selected = currentStatus === option.value
                  const Icon = option.icon
                  const saving = savingStatus === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={savingStatus != null}
                      onClick={async () => {
                        if (selected) {
                          setOpen(false)
                          return
                        }
                        setSavingStatus(option.value)
                        try {
                          await onSelect(option.value)
                          setOpen(false)
                        } finally {
                          setSavingStatus(null)
                        }
                      }}
                      className={`flex w-full min-h-11 items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left disabled:opacity-60 ${
                        selected
                          ? option.selectedClass
                          : 'border-transparent hover:bg-muted/60'
                      }`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {option.label}
                          {selected ? (
                            <span className="text-xs font-medium text-muted-foreground">현재</span>
                          ) : null}
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground leading-4">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </>,
            document.body
          )
        : null}
    </>
  )
}
