'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, Circle, Loader2, PauseCircle } from 'lucide-react'

type TodoPanelStatusButtonsProps = {
  locale: string
  completed: boolean
  onHold?: boolean
  busy?: boolean
  holdBusy?: boolean
  onToggleComplete: () => void
  onToggleHold?: (() => void) | undefined
  holdEnabled?: boolean
  /** holdEnabled가 false일 때 툴팁 (미지정 시 기본 문구) */
  holdDisabledHint?: string | undefined
  size?: 'default' | 'sm'
}

type MenuAction = {
  key: string
  label: string
  disabled?: boolean
  hint?: string | undefined
  onSelect: () => void
  tone?: 'default' | 'amber' | 'emerald'
}

export function TodoPanelStatusButtons({
  locale,
  completed,
  onHold = false,
  busy = false,
  holdBusy = false,
  onToggleComplete,
  onToggleHold,
  holdEnabled = false,
  holdDisabledHint,
  size = 'default',
}: TodoPanelStatusButtonsProps) {
  const isKo = locale === 'ko'
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const menuIconClass = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const loading = busy || holdBusy

  const holdInteractive = holdEnabled && !!onToggleHold && !completed
  const holdDisabledDefaultHint =
    holdDisabledHint ??
    (!onToggleHold
      ? isKo
        ? '연결된 할일이 없어 보류할 수 없습니다'
        : 'No linked to-do to put on hold'
      : isKo
        ? '보류 기능을 사용하려면 DB 마이그레이션을 적용해 주세요'
        : 'Apply DB migration to enable on-hold')

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const runAction = (action: () => void) => {
    setOpen(false)
    void action()
  }

  const menuActions: MenuAction[] = completed
    ? [
        {
          key: 'incomplete',
          label: isKo ? '완료 취소' : 'Mark incomplete',
          onSelect: () => runAction(onToggleComplete),
        },
      ]
    : onHold
      ? [
          {
            key: 'resume',
            label: isKo ? '보류 해제' : 'Resume',
            disabled: !holdInteractive,
            hint: holdInteractive ? undefined : holdDisabledDefaultHint,
            onSelect: () => {
              if (holdInteractive && onToggleHold) runAction(onToggleHold)
            },
            tone: 'amber',
          },
          {
            key: 'complete',
            label: isKo ? '완료' : 'Mark complete',
            onSelect: () => runAction(onToggleComplete),
            tone: 'emerald',
          },
        ]
      : [
          {
            key: 'complete',
            label: isKo ? '완료' : 'Mark complete',
            onSelect: () => runAction(onToggleComplete),
            tone: 'emerald',
          },
          {
            key: 'hold',
            label: isKo ? '보류' : 'Put on hold',
            disabled: !holdInteractive,
            hint: holdInteractive ? undefined : holdDisabledDefaultHint,
            onSelect: () => {
              if (holdInteractive && onToggleHold) runAction(onToggleHold)
            },
            tone: 'amber',
          },
        ]

  const statusTitle = completed
    ? isKo
      ? '완료됨 — 상태 변경'
      : 'Completed — change status'
    : onHold
      ? isKo
        ? '보류 — 상태 변경'
        : 'On hold — change status'
      : isKo
        ? '상태 변경 (완료 / 보류)'
        : 'Change status (complete / hold)'

  const handleToggleMenu = () => {
    if (loading) return
    setOpen((prev) => !prev)
  }

  return (
    <div ref={rootRef} className={`relative shrink-0 ${size === 'sm' ? '' : 'mt-0.5'}`}>
      <button
        type="button"
        disabled={loading}
        onClick={handleToggleMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={`rounded p-0.5 transition-colors disabled:opacity-50 ${
          completed
            ? 'text-emerald-600 hover:bg-emerald-50'
            : onHold
              ? 'text-amber-600 hover:bg-amber-50'
              : 'text-gray-500 hover:bg-gray-100'
        }`}
        aria-label={statusTitle}
        title={statusTitle}
      >
        {loading ? (
          <Loader2 className={`${iconClass} animate-spin`} />
        ) : completed ? (
          <CheckCircle2 className={`${iconClass} text-emerald-600`} />
        ) : onHold ? (
          <PauseCircle className={`${iconClass} fill-amber-100 text-amber-600`} />
        ) : (
          <Circle className={iconClass} />
        )}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[7.5rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {menuActions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              title={action.disabled ? action.hint : undefined}
              onClick={action.onSelect}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                action.tone === 'emerald'
                  ? 'text-emerald-700 hover:bg-emerald-50'
                  : action.tone === 'amber'
                    ? 'text-amber-800 hover:bg-amber-50'
                    : 'text-gray-800 hover:bg-gray-50'
              }`}
            >
              {action.tone === 'emerald' ? (
                <CheckCircle2 className={`${menuIconClass} shrink-0`} />
              ) : action.tone === 'amber' ? (
                <PauseCircle className={`${menuIconClass} shrink-0`} />
              ) : (
                <Circle className={`${menuIconClass} shrink-0`} />
              )}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
