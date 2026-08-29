'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Headphones } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { isGoblinNarrationReminderWindow } from '@/lib/goblinTour'
import { fetchToursNarrationHistory } from '@/lib/tourNarrationPlays'
import TourNarrationHistoryModal from '@/components/tour/TourNarrationHistoryModal'

const DISMISS_PREFIX = 'admin_goblin_narration_reminder:'

function dismissKey(dateYmd: string): string {
  return `${DISMISS_PREFIX}${dateYmd}`
}

export default function AdminGoblinNarrationReminderModal({ locale }: { locale: string }) {
  const pathname = usePathname() ?? ''
  const { operatorId } = useOperatorOptional()
  const isEn = locale === 'en'
  const [open, setOpen] = useState(false)
  const [today, setToday] = useState('')
  const closedThisSessionRef = useRef(false)

  const maybeOpen = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!pathname.includes('/admin')) return
    if (closedThisSessionRef.current) return
    if (open) return
    if (!isGoblinNarrationReminderWindow()) return
    const ymd = todayInLasVegas()
    setToday(ymd)
    try {
      if (localStorage.getItem(dismissKey(ymd)) === '1') return
    } catch {
      /* ignore */
    }
    const rows = await fetchToursNarrationHistory({
      startDate: ymd,
      endDate: ymd,
      operatorId,
      goblinOnly: true,
      locale,
    })
    if (rows.length === 0) return
    setOpen(true)
  }, [pathname, operatorId, locale, open])

  useEffect(() => {
    void maybeOpen()
    const timer = window.setInterval(() => {
      void maybeOpen()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [maybeOpen])

  const handleClose = () => {
    closedThisSessionRef.current = true
    setOpen(false)
  }

  const handleDismissToday = () => {
    const ymd = today || todayInLasVegas()
    try {
      localStorage.setItem(dismissKey(ymd), '1')
    } catch {
      /* ignore */
    }
    handleClose()
  }

  return (
    <TourNarrationHistoryModal
      isOpen={open}
      onClose={handleClose}
      locale={locale}
      startDate={today || todayInLasVegas()}
      endDate={today || todayInLasVegas()}
      goblinOnly
      title={isEn ? "Today's goblin tour narration" : '오늘 밤도깨비 나레이션 재생'}
      subtitle={
        isEn
          ? 'Las Vegas 6:00 PM check — whether each goblin tour played narration, which files, how long, and who played them.'
          : '라스베가스 오후 6시 확인 — 투어별로 나레이션을 틀었는지, 어떤 파일을 얼마나, 누가 재생했는지 안내합니다.'
      }
      extraActions={
        <button
          type="button"
          onClick={handleDismissToday}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <Headphones className="h-3.5 w-3.5" />
          {isEn ? "Don't show again today" : '오늘은 다시 보지 않기'}
        </button>
      }
    />
  )
}
