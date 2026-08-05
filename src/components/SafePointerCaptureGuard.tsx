'use client'

import { useEffect } from 'react'

declare global {
  interface Element {
    __safeReleasePointerCapturePatched?: boolean
  }
}

/**
 * 모바일 탭·라우트 전환 중 Element가 언마운트되면
 * releasePointerCapture(pointerId) 가 NotFoundError 를 던질 수 있음.
 * (Radix / DnD / 브라우저 네이티브 핸들러에서 흔함)
 */
export default function SafePointerCaptureGuard() {
  useEffect(() => {
    if (typeof Element === 'undefined') return

    const proto = Element.prototype
    if (proto.__safeReleasePointerCapturePatched) return

    const original = proto.releasePointerCapture
    if (typeof original !== 'function') return

    proto.releasePointerCapture = function safeReleasePointerCapture(
      this: Element,
      pointerId: number
    ) {
      try {
        if (
          typeof this.hasPointerCapture === 'function' &&
          !this.hasPointerCapture(pointerId)
        ) {
          return
        }
        original.call(this, pointerId)
      } catch {
        // No active pointer with the given id — ignore
      }
    }

    proto.__safeReleasePointerCapturePatched = true
  }, [])

  return null
}
