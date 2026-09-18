'use client'

import { useEffect, useState } from 'react'
import {
  PRINT_SIGNATURE_TARGET_HEIGHT,
  inkifySignatureFromUrl,
} from '@/lib/inkifySignatureImage'

export default function PrintSignatureImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [inkSrc, setInkSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void inkifySignatureFromUrl(src, PRINT_SIGNATURE_TARGET_HEIGHT).then((next) => {
      if (!cancelled) setInkSrc(next)
    })
    return () => {
      cancelled = true
    }
  }, [src])

  if (!src) return null

  return (
    <span className="cwf-sig-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={inkSrc || src}
        alt={alt}
        className={className || 'cwf-sig'}
        data-ink-state={inkSrc ? 'ready' : 'pending'}
      />
    </span>
  )
}
