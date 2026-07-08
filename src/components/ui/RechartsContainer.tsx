'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

type RechartsContainerProps = {
  height: number
  className?: string
  children: ReactElement
}

/**
 * Recharts ResponsiveContainer wrapper that waits for a measurable parent
 * before rendering, avoiding width(-1)/height(-1) console warnings.
 */
export default function RechartsContainer({ height, className, children }: RechartsContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const updateSize = () => {
      const rect = node.getBoundingClientRect()
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(node)

    return () => observer.disconnect()
  }, [height])

  return (
    <div
      ref={containerRef}
      className={cn('w-full min-w-0', className)}
      style={{ height }}
    >
      {size.width > 0 && size.height > 0 ? (
        <ResponsiveContainer width={size.width} height={size.height} minWidth={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}
