'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ACCOUNTING_HINTS, type AccountingTermKey } from '@/lib/accounting-term-hints'

type Props = {
  /** ACCOUNTING_HINTS에 있는 키 */
  termKey: AccountingTermKey
  /** 화면에 보이는 글자(없으면 termKey와 동일한 키 문자열 표시) */
  children?: React.ReactNode
  className?: string
}

const TOOLTIP_Z = 9998 /** 헤더(z-[9999]) 바로 아래, 사이드바·스크롤 영역 위 */

/**
 * 회계 용어에 마우스를 올리면 쉬운 설명 툴팁(밑줄 점선 + 호버 박스, title 보조)
 * 본문·표의 overflow에 잘리지 않도록 body 포털 + fixed 로 표시합니다.
 */
export function AccountingTerm({ termKey, children, className = '' }: Props) {
  const hint = ACCOUNTING_HINTS[termKey]
  const label = children ?? termKey
  const triggerRef = useRef<HTMLSpanElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const maxW = Math.min(22 * 16, window.innerWidth - 24)
    const half = maxW / 2
    const center = r.left + r.width / 2
    const left = Math.max(12 + half, Math.min(center, window.innerWidth - 12 - half))
    setPos({ left, top: r.top - 6 })
  }, [])

  const show = useCallback(() => {
    clearHideTimer()
    updatePosition()
  }, [clearHideTimer, updatePosition])

  const hideSoon = useCallback(() => {
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => setPos(null), 120)
  }, [clearHideTimer])

  const hideNow = useCallback(() => {
    clearHideTimer()
    setPos(null)
  }, [clearHideTimer])

  useEffect(() => () => clearHideTimer(), [clearHideTimer])

  useEffect(() => {
    if (!pos) return
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [pos, updatePosition])

  const portal =
    mounted &&
    pos &&
    typeof document !== 'undefined' &&
    createPortal(
      <span
        role="tooltip"
        className="fixed w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white shadow-xl"
        style={{
          left: pos.left,
          top: pos.top,
          zIndex: TOOLTIP_Z
        }}
        onMouseEnter={clearHideTimer}
        onMouseLeave={hideSoon}
      >
        {hint}
      </span>,
      document.body
    )

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-block max-w-full align-baseline ${className}`}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideNow}
      >
        <span
          className="cursor-help border-b border-dotted border-slate-500 text-inherit underline-offset-2"
          title={hint}
        >
          {label}
        </span>
      </span>
      {portal}
    </>
  )
}
