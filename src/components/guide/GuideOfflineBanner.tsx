'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function GuideOfflineBanner() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  )

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900"
      role="status"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        오프라인입니다. 마지막으로 불러온 데이터를 표시합니다. 연결되면 자동으로 갱신됩니다.
      </span>
    </div>
  )
}
