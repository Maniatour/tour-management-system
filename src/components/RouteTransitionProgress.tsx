'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

function isInternalNavigationHref(href: string): boolean {
  if (!href || href.startsWith('#')) return false
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      return new URL(href).origin === window.location.origin
    } catch {
      return false
    }
  }
  return href.startsWith('/')
}

export default function RouteTransitionProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href || !isInternalNavigationHref(href)) return

      const nextPath = href.startsWith('/')
        ? href.split('?')[0]
        : new URL(href, window.location.origin).pathname

      if (nextPath === pathname) return

      setActive(true)
      setProgress((value) => (value < 15 ? 15 : value))
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname])

  useEffect(() => {
    if (prevPathname.current === pathname) return

    setActive(true)
    setProgress(100)
    const timer = window.setTimeout(() => {
      setActive(false)
      setProgress(0)
    }, 220)
    prevPathname.current = pathname
    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    if (!active || progress >= 90) return

    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 90) return value
        return Math.min(value + 6 + Math.random() * 10, 90)
      })
    }, 180)

    return () => window.clearInterval(timer)
  }, [active, progress])

  if (!active && progress === 0) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5 bg-primary/10/80"
    >
      <div
        className="h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.45)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
