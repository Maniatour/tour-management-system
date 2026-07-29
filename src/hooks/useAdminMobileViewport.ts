'use client'

import { useEffect, useState } from 'react'
import { isAdminMobileViewport } from '@/lib/adminFloatingFabLayout'

export function useAdminMobileViewport(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? isAdminMobileViewport() : false
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return mobile
}
